import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // VLM calls can take 10–30s

// ──────────────────────────────────────────────────────────────────────────
// POST /api/claims/analyze-image
//
// Accepts multipart/form-data:
//   image    — one or more image files (JPEG, PNG, WebP, GIF, BMP)
//   claimId  — optional. If provided, the claim is updated with the analysis
//              and its damageDepthRatio is auto-filled from the severity.
//   livestockType — optional context string (e.g. "Cattle", "Goat")
//   category      — optional context string (e.g. "DAIRY", "BEEF")
//
// Returns:
//   {
//     analyses: Array<{
//       severity: number,           // 0.0–1.0
//       damageType: string,         // INJURY | DISEASE | MALNUTRITION | DEATH | OTHER | NONE
//       confidence: string,         // LOW | MEDIUM | HIGH
//       reasoning: string,
//       visibleSymptoms: string[],
//       recommendation: string,
//       modelName: string,
//     }>,
//     aggregate: {
//       maxSeverity: number,
//       avgSeverity: number,
//       recommendedDamageDepth: number,
//       overallDamageType: string,
//       overallConfidence: string,
//       reasoning: string,
//     },
//     claim: Claim | null,          // the updated claim, if claimId was provided
//   }
// ──────────────────────────────────────────────────────────────────────────

interface VLMAnalysisResult {
  severity: number;
  damageType: string;
  confidence: string;
  reasoning: string;
  visibleSymptoms: string[];
  recommendation: string;
}

const VALID_DAMAGE_TYPES = ['INJURY', 'DISEASE', 'MALNUTRITION', 'DEATH', 'OTHER', 'NONE'];
const VALID_CONFIDENCE = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_RECS = ['REPLANT_ALLOWANCE', 'FULL_INDEMNITY', 'VETERINARY_INSPECTION', 'NO_CLAIM'];

function buildPrompt(livestockType: string, category: string): string {
  return `You are an agricultural insurance damage assessor specializing in livestock.
Analyze this image of a livestock animal and assess the visible damage severity.

Context:
- Livestock type: ${livestockType || 'unknown'}
- Category: ${category || 'unknown'}

Assess the damage on a scale of 0.0 to 1.0:
- 0.0 = no visible damage (healthy animal)
- 0.1–0.3 = minor injury or mild condition
- 0.4–0.6 = moderate injury or visible disease
- 0.7–0.9 = severe injury, advanced disease, or near death
- 1.0 = deceased animal (total loss)

Return your assessment as STRICT JSON (and nothing else — no markdown, no code fences) with these exact fields:
{
  "severity": <number between 0.0 and 1.0>,
  "damageType": "<one of: INJURY, DISEASE, MALNUTRITION, DEATH, OTHER, NONE>",
  "confidence": "<one of: LOW, MEDIUM, HIGH>",
  "reasoning": "<one or two sentences explaining what you observed>",
  "visibleSymptoms": ["<symptom 1>", "<symptom 2>"],
  "recommendation": "<one of: REPLANT_ALLOWANCE, FULL_INDEMNITY, VETERINARY_INSPECTION, NO_CLAIM>"
}

Rules:
- If the image does not contain an animal, return severity 0.0, damageType "NONE", recommendation "NO_CLAIM".
- If you are unsure, set confidence to "LOW".
- Do not invent symptoms you cannot see.
- Output ONLY the JSON object.`;
}

function parseVLMResponse(raw: string): VLMAnalysisResult {
  // The VLM may wrap JSON in markdown code fences or preamble — extract the JSON.
  let jsonStr = raw.trim();

  // Strip ```json ... ``` fences
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Find the first { and last } as a fallback
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // If JSON parse fails, return a default "could not analyze" result
    return {
      severity: 0.5,
      damageType: 'OTHER',
      confidence: 'LOW',
      reasoning: `Model response could not be parsed as JSON. Raw response: ${raw.slice(0, 200)}`,
      visibleSymptoms: [],
      recommendation: 'VETERINARY_INSPECTION',
    };
  }

  // Validate + clamp fields
  let severity = Number(parsed.severity);
  if (Number.isNaN(severity)) severity = 0.5;
  severity = Math.max(0, Math.min(1, severity));

  const damageType = VALID_DAMAGE_TYPES.includes(String(parsed.damageType))
    ? String(parsed.damageType)
    : 'OTHER';

  const confidence = VALID_CONFIDENCE.includes(String(parsed.confidence))
    ? String(parsed.confidence)
    : 'LOW';

  const recommendation = VALID_RECS.includes(String(parsed.recommendation))
    ? String(parsed.recommendation)
    : 'VETERINARY_INSPECTION';

  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided.';
  const visibleSymptoms = Array.isArray(parsed.visibleSymptoms)
    ? parsed.visibleSymptoms.filter((s): s is string => typeof s === 'string').slice(0, 10)
    : [];

  return { severity, damageType, confidence, reasoning, visibleSymptoms, recommendation };
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const claimId = formData.get('claimId') as string | null;
  const livestockType = (formData.get('livestockType') as string | null) || '';
  const category = (formData.get('category') as string | null) || '';

  // Collect all image files
  const imageFiles = formData.getAll('image').filter((f): f is File => f instanceof File && f.size > 0);
  if (imageFiles.length === 0) {
    return NextResponse.json({ error: 'At least one image file is required (field name: "image")' }, { status: 400 });
  }

  // Cap at 5 images per request to bound VLM cost
  if (imageFiles.length > 5) {
    return NextResponse.json({ error: 'Maximum 5 images per analysis request' }, { status: 400 });
  }

  // Validate file types
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  for (const f of imageFiles) {
    if (!ALLOWED.includes(f.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${f.type} (${f.name}). Allowed: ${ALLOWED.join(', ')}` },
        { status: 400 },
      );
    }
    // 10 MB per image cap
    if (f.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: `File too large: ${f.name} (max 10 MB)` }, { status: 400 });
    }
  }

  // Dynamically import the SDK (backend-only — never expose to client)
  let zai: { chat: { completions: { createVision: (opts: unknown) => Promise<{ choices: Array<{ message?: { content?: string } }> }> } } };
  try {
    const ZAIModule: any = await import('z-ai-web-dev-sdk');
    const ZAI = ZAIModule.default || ZAIModule;
    zai = await ZAI.create();
  } catch (e) {
    return NextResponse.json(
      { error: 'Vision model SDK not available', detail: (e as Error).message },
      { status: 503 },
    );
  }

  const prompt = buildPrompt(livestockType, category);
  const analyses: Array<VLMAnalysisResult & { imageName: string; modelName: string }> = [];

  for (const file of imageFiles) {
    // Read the file as ArrayBuffer → base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    try {
      const response = await zai.chat.completions.createVision({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });

      const rawContent = response.choices?.[0]?.message?.content ?? '';
      const parsed = parseVLMResponse(rawContent);
      analyses.push({ ...parsed, imageName: file.name, modelName: 'glm-4v' });
    } catch (e) {
      analyses.push({
        severity: 0.5,
        damageType: 'OTHER',
        confidence: 'LOW',
        reasoning: `VLM call failed: ${(e as Error).message}`,
        visibleSymptoms: [],
        recommendation: 'VETERINARY_INSPECTION',
        imageName: file.name,
        modelName: 'glm-4v',
      });
    }
  }

  // Aggregate: take the max severity across all images (worst-case wins for insurance)
  const maxSeverity = Math.max(...analyses.map((a) => a.severity));
  const avgSeverity = analyses.reduce((sum, a) => sum + a.severity, 0) / analyses.length;
  const recommendedDamageDepth = Math.round(maxSeverity * 100) / 100;

  // Overall damage type = the one from the highest-severity image
  const worstAnalysis = analyses.find((a) => a.severity === maxSeverity) ?? analyses[0];
  const overallDamageType = worstAnalysis.damageType;
  const overallConfidence = worstAnalysis.confidence;
  const reasoning = analyses.length === 1
    ? worstAnalysis.reasoning
    : `Worst-case severity ${maxSeverity.toFixed(2)} from image "${worstAnalysis.imageName}". ${worstAnalysis.reasoning}`;

  const aggregate = {
    maxSeverity,
    avgSeverity: Math.round(avgSeverity * 1000) / 1000,
    recommendedDamageDepth,
    overallDamageType,
    overallConfidence,
    reasoning,
  };

  // If a claimId was provided, update the claim with the analysis + auto-fill damage depth
  let updatedClaim: unknown = null;
  if (claimId) {
    try {
      updatedClaim = await db.insuranceClaim.update({
        where: { id: claimId },
        data: {
          imageAnalysisSeverity: maxSeverity,
          imageAnalysisDamageType: overallDamageType,
          imageAnalysisConfidence: overallConfidence,
          imageAnalysisReasoning: reasoning,
          imageAnalysisSymptoms: JSON.stringify(analyses.flatMap((a) => a.visibleSymptoms)),
          imageAnalysisRecommendation: worstAnalysis.recommendation,
          imageAnalysisModel: 'glm-4v',
          imageAnalysisAt: new Date(),
          // Auto-fill the damage depth ratio from the VLM assessment (only if the claim is still SUBMITTED)
          ...(worstAnalysis.recommendation !== 'NO_CLAIM' ? { damageDepthRatio: recommendedDamageDepth } : {}),
        },
        include: { policy: { include: { farmer: true, livestock: true, variety: true } } },
      });
    } catch (e) {
      // Don't fail the whole request if the DB update fails — still return the analysis
      console.error('Failed to update claim with image analysis:', e);
    }
  }

  return NextResponse.json({
    analyses: analyses.map(({ imageName, modelName, ...rest }) => ({ ...rest, imageName, modelName })),
    aggregate,
    claim: updatedClaim,
  });
}

'use client';

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Upload, X, ImageIcon, Loader2, Scan, AlertTriangle, CheckCircle2, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiFetch, type ImageAnalysisResult } from './shared';

interface UploadedImage {
  file: File;
  previewUrl: string;
}

interface ImageUploadProps {
  /** Optional claim ID — if provided, the analysis result is persisted to the claim. */
  claimId?: string;
  /** Context passed to the VLM for better assessment. */
  livestockType?: string;
  category?: string;
  /** Called when analysis completes with the recommended damage depth (0–1). */
  onAnalysisComplete?: (result: ImageAnalysisResult) => void;
  /** Compact mode for embedding inside a dialog. */
  compact?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGES = 5;

export function ImageUpload({ claimId, livestockType, category, onAnalysisComplete, compact = false }: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const valid: UploadedImage[] = [];
    for (const f of fileArr) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`Unsupported file type: ${f.name}`, { description: `Allowed: JPEG, PNG, WebP, GIF, BMP` });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`File too large: ${f.name}`, { description: 'Max 10 MB per image' });
        continue;
      }
      valid.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    if (valid.length === 0) return;
    setImages((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_IMAGES) {
        toast.warning(`Max ${MAX_IMAGES} images`, { description: `Only the first ${MAX_IMAGES} will be kept.` });
        return combined.slice(0, MAX_IMAGES);
      }
      return combined;
    });
    setResult(null); // clear previous analysis when new images are added
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset so selecting the same file again re-triggers
      e.target.value = '';
    }
  }, [addFiles]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].previewUrl);
      next.splice(index, 1);
      return next;
    });
    setResult(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) {
      toast.error('Please add at least one image first');
      return;
    }
    setAnalyzing(true);
    try {
      const formData = new FormData();
      for (const img of images) {
        formData.append('image', img.file);
      }
      if (claimId) formData.append('claimId', claimId);
      if (livestockType) formData.append('livestockType', livestockType);
      if (category) formData.append('category', category);

      const data = await apiFetch<ImageAnalysisResult>('/api/claims/analyze-image', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — browser sets it with boundary for FormData
      });
      setResult(data);
      onAnalysisComplete?.(data);
      toast.success('Image analysis complete', {
        description: `Severity ${(data.aggregate.maxSeverity * 100).toFixed(0)}% · ${data.aggregate.overallDamageType} · ${data.aggregate.overallConfidence} confidence`,
        duration: 6000,
      });
    } catch (e) {
      toast.error('Image analysis failed', { description: (e as Error).message, duration: 8000 });
    } finally {
      setAnalyzing(false);
    }
  }, [images, claimId, livestockType, category, onAnalysisComplete]);

  // Cleanup object URLs on unmount
  const cleanupRef = useRef<() => void>();
  cleanupRef.current = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
  };

  return (
    <div className={cn('space-y-4', compact ? '' : 'rounded-xl border border-slate-200 bg-white p-4')}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragOver
            ? 'border-[#2A7A65] bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload className={cn('h-8 w-8', dragOver ? 'text-[#2A7A65]' : 'text-slate-400')} />
        <p className="mt-2 text-sm font-medium text-slate-700">
          Drag and drop livestock photos here, or{' '}
          <span className="text-[#0C3B2E] underline">click to browse</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          JPEG, PNG, WebP, GIF, BMP · max 10 MB each · up to {MAX_IMAGES} images
        </p>
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <img
                src={img.previewUrl}
                alt={img.file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
              <p className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-white">
                {img.file.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Analyze button */}
      {images.length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-[#0C3B2E] text-white hover:bg-[#0C3B2E]/90"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing with vision model…
              </>
            ) : (
              <>
                <Scan className="mr-2 h-4 w-4" />
                Analyze damage severity
              </>
            )}
          </Button>
          <span className="text-xs text-slate-500">
            {images.length} image{images.length !== 1 ? 's' : ''} ready · VLM analyzes each and takes the worst-case severity
          </span>
        </div>
      )}

      {/* Analysis result */}
      {result && (
        <AnalysisResultDisplay result={result} />
      )}

      {/* Disclaimer */}
      {images.length === 0 && (
        <p className="flex items-start gap-2 text-xs text-slate-400">
          <Stethoscope className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            The vision model provides a preliminary damage assessment to pre-fill the damage depth.
            For high-value claims, a qualified veterinarian or loss adjuster must verify the assessment before payout.
          </span>
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Result display — shows severity gauge, damage type, symptoms, reasoning
// ──────────────────────────────────────────────────────────────────────────

function AnalysisResultDisplay({ result }: { result: ImageAnalysisResult }) {
  const { aggregate, analyses } = result;
  const severityPct = Math.round(aggregate.maxSeverity * 100);
  const severityColor = severityPct >= 70 ? 'rose' : severityPct >= 40 ? 'amber' : 'emerald';
  const severityLabel = severityPct >= 70 ? 'Severe' : severityPct >= 40 ? 'Moderate' : severityPct > 0 ? 'Minor' : 'None';

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Scan className="h-5 w-5 text-[#0C3B2E]" />
        <h4 className="text-sm font-semibold text-slate-900">Vision model damage assessment</h4>
      </div>

      {/* Severity gauge */}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className={cn(
            'flex h-20 w-20 flex-col items-center justify-center rounded-full border-4',
            severityColor === 'rose' && 'border-rose-500 bg-rose-50 text-rose-700',
            severityColor === 'amber' && 'border-amber-500 bg-amber-50 text-amber-700',
            severityColor === 'emerald' && 'border-emerald-500 bg-emerald-50 text-emerald-700',
          )}>
            <span className="text-2xl font-bold tabular-nums">{severityPct}%</span>
            <span className="text-[10px] uppercase tracking-wide">{severityLabel}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
              Type: {aggregate.overallDamageType}
            </Badge>
            <Badge variant="outline" className={cn(
              aggregate.overallConfidence === 'HIGH' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              aggregate.overallConfidence === 'MEDIUM' && 'border-amber-200 bg-amber-50 text-amber-700',
              aggregate.overallConfidence === 'LOW' && 'border-rose-200 bg-rose-50 text-rose-700',
            )}>
              Confidence: {aggregate.overallConfidence}
            </Badge>
            <Badge variant="outline" className="border-[#0C3B2E]/30 bg-[#0C3B2E]/5 text-[#0C3B2E]">
              Rec: {aggregate.recommendedDamageDepth >= 0.7 ? 'FULL_INDEMNITY' : aggregate.recommendedDamageDepth > 0 ? 'ASSESS' : 'NO_CLAIM'}
            </Badge>
          </div>
          <Progress value={severityPct} className={cn(
            'h-2',
            severityColor === 'rose' && 'bg-rose-100 [&>div]:bg-rose-500',
            severityColor === 'amber' && 'bg-amber-100 [&>div]:bg-amber-500',
            severityColor === 'emerald' && 'bg-emerald-100 [&>div]:bg-emerald-500',
          )} />
          <p className="text-xs text-slate-600">{aggregate.reasoning}</p>
        </div>
      </div>

      {/* Per-image breakdown (only if multiple images) */}
      {analyses.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Per-image breakdown</p>
          {analyses.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded border border-slate-200 bg-white p-2 text-xs">
              <ImageIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-700">{a.imageName}</span>
                  <span className="tabular-nums text-slate-500">{(a.severity * 100).toFixed(0)}%</span>
                </div>
                <p className="text-slate-600">{a.reasoning}</p>
                {a.visibleSymptoms.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.visibleSymptoms.map((s, j) => (
                      <span key={j} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visible symptoms (single image) */}
      {analyses.length === 1 && analyses[0].visibleSymptoms.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Visible symptoms</p>
          <div className="flex flex-wrap gap-1">
            {analyses[0].visibleSymptoms.map((s, i) => (
              <span key={i} className="rounded bg-white px-2 py-0.5 text-xs text-slate-700 border border-slate-200">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Status indicator */}
      <div className={cn(
        'flex items-start gap-2 rounded-md p-2 text-xs',
        aggregate.recommendedDamageDepth >= 0.7 ? 'bg-rose-50 text-rose-800' :
        aggregate.recommendedDamageDepth >= 0.3 ? 'bg-amber-50 text-amber-800' :
        'bg-emerald-50 text-emerald-800',
      )}>
        {aggregate.recommendedDamageDepth >= 0.3 ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
        )}
        <span>
          {aggregate.recommendedDamageDepth >= 0.7
            ? 'High severity detected. The damage depth slider has been auto-filled. Recommend veterinary inspection before payout.'
            : aggregate.recommendedDamageDepth >= 0.3
            ? 'Moderate severity detected. The damage depth slider has been auto-filled. Confirm or adjust before filing.'
            : 'Low or no damage detected. The claim damage depth is left at the model\'s recommendation — adjust manually if needed.'}
        </span>
      </div>

      <p className="text-[10px] text-slate-400">
        Model: {analyses[0]?.modelName ?? 'VLM'} · This is a preliminary AI assessment, not a veterinary diagnosis.
        Verified by: vision model only — adjuster review required for claims above policy threshold.
      </p>
    </div>
  );
}

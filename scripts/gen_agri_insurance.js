/**
 * Agricultural Insurance System Implementation Plan — Regenerated
 * Output: /home/z/my-project/download/Agricultural_Insurance_System_Implementation_Plan.docx
 *
 * Design:
 *  - Recipe: R1 (Pure Paragraph Cover, left-aligned)
 *  - Palette: Custom "CORP_BLUE" (dark navy bg + steel-blue accent, IBM/Deloitte feel)
 *  - 3 sections: Cover (no page#) → Front matter (TOC, Roman i,ii,iii) → Body (Arabic 1,2,3...)
 *  - Profile A formal fonts (Times New Roman body, Calibri/SimHei headings)
 *  - All ASCII diagrams and code blocks preserved from original in monospace
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableLayoutType, SectionType, TableOfContents,
  LevelFormat,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// 1. Palette — Custom Corporate Blue (IBM/Deloitte feel)
// ─────────────────────────────────────────────────────────────
const CORP_BLUE = {
  bg: "0F2A4A",            // deep navy cover background
  primary: "FFFFFF",       // cover title color
  accent: "4A90E2",        // steel blue accent
  cover: {
    titleColor: "FFFFFF",
    subtitleColor: "C8D6E5",
    metaColor: "9AAFC8",
    footerColor: "708AA8",
  },
  table: {
    headerBg: "1A5276",    // navy header for body tables
    headerText: "FFFFFF",
    accentLine: "1A5276",
    innerLine: "D0DDE8",
    surface: "EDF3F8",     // very light blue alt-row
  },
  body: {
    primary: "1A2B45",     // body heading color (dark navy)
    text: "1F2937",        // body text (near-black)
    secondary: "5B6B7D",   // captions
  },
};

// Convenience: strip "#" from hex for docx color fields
const c = (hex) => (hex || "").replace("#", "");

// ─────────────────────────────────────────────────────────────
// 2. Page geometry
// ─────────────────────────────────────────────────────────────
const PG_SIZE = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const PG_MARGIN_BODY = { top: 1440, bottom: 1440, left: 1701, right: 1417 };
const PG_MARGIN_COVER = { top: 0, bottom: 0, left: 0, right: 0 };

// ─────────────────────────────────────────────────────────────
// 3. Borders helpers
// ─────────────────────────────────────────────────────────────
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};

// ─────────────────────────────────────────────────────────────
// 4. Title layout helpers (from design-system.md)
// ─────────────────────────────────────────────────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([
    ...",.;:!?", ...' \t', ...'-_/',
  ]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // English title: each char ≈ pt * 11 twips (narrower than CJK)
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 4) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight +
                        metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ─────────────────────────────────────────────────────────────
// 5. Cover Recipe R1 (Pure Paragraph Cover, left-aligned)
// ─────────────────────────────────────────────────────────────
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;

  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. Top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. English label with accent bottom border
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent,
        font: { ascii: "Calibri", eastAsia: "SimHei" },
        characterSpacing: 40,
      })],
    }));
  }

  // 3. Main title (multi-line, dynamic size)
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 300,
        line: Math.ceil(titlePt * 23),
        lineRule: "atLeast",
      },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, bold: true,
        color: P.cover.titleColor,
        font: { eastAsia: "SimHei", ascii: "Arial" },
      })],
    }));
  }

  // 4. Subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800, line: 360, lineRule: "atLeast" },
      children: [new TextRun({
        text: config.subtitle, size: 24, color: P.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  // 5. Meta info lines with left accent border
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 22, color: P.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  // 6. Bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. Footer with top accent separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                                  " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: CORP_BLUE.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ─────────────────────────────────────────────────────────────
// 6. Body builders
// ─────────────────────────────────────────────────────────────

// H1 — chapter heading
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180, line: 312 },
    children: [new TextRun({
      text, bold: true, size: 32, color: c(CORP_BLUE.body.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

// H2
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140, line: 312 },
    children: [new TextRun({
      text, bold: true, size: 28, color: c(CORP_BLUE.body.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

// H3
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 110, line: 312 },
    children: [new TextRun({
      text, bold: true, size: 24, color: c(CORP_BLUE.body.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

// Body paragraph (English: Times New Roman, justified, first-line indent)
function p(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 360 },
    spacing: { line: 312, after: 100 },
    children: [new TextRun({
      text, size: 24, color: c(CORP_BLUE.body.text),
      font: { ascii: "Times New Roman", eastAsia: "Times New Roman" },
    })],
  });
}

// Bullet item (no first-line indent, hanging)
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({
      text, size: 24, color: c(CORP_BLUE.body.text),
      font: { ascii: "Times New Roman", eastAsia: "Times New Roman" },
    })],
  });
}

// Monospace code block — paragraph per line, with subtle surface shading via paragraph border
function codeBlock(codeText) {
  const lines = codeText.split("\n");
  return lines.map((line, i) => new Paragraph({
    spacing: { line: 220, lineRule: "atLeast", before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 160 : 0 },
    indent: { left: 180, right: 180 },
    shading: { type: ShadingType.CLEAR, fill: "F4F6FA" },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: c(CORP_BLUE.accent), space: 6 },
      top: i === 0 ? { style: BorderStyle.SINGLE, size: 4, color: "D0DDE8", space: 4 } : undefined,
      bottom: i === lines.length - 1 ? { style: BorderStyle.SINGLE, size: 4, color: "D0DDE8", space: 4 } : undefined,
      right: { style: BorderStyle.SINGLE, size: 4, color: "D0DDE8", space: 4 },
    },
    children: [new TextRun({
      text: line || " ", size: 16,
      font: { ascii: "Courier New", eastAsia: "Courier New" },
      color: c(CORP_BLUE.body.text),
    })],
  }));
}

// Caption (table/figure)
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 160 },
    keepNext: true,
    children: [new TextRun({
      text, italics: true, size: 21, color: c(CORP_BLUE.body.secondary),
      font: { ascii: "Times New Roman", eastAsia: "Times New Roman" },
    })],
  });
}

// Table cell helper
function tcell(text, opts = {}) {
  const isHeader = opts.header === true;
  return new TableCell({
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { line: 280, before: 40, after: 40 },
      children: [new TextRun({
        text, bold: isHeader, size: opts.size || 20,
        color: isHeader ? c(CORP_BLUE.table.headerText) : c(CORP_BLUE.body.text),
        font: { ascii: "Calibri", eastAsia: "SimHei" },
      })],
    })],
    shading: isHeader
      ? { type: ShadingType.CLEAR, fill: c(CORP_BLUE.table.headerBg) }
      : (opts.zebra ? { type: ShadingType.CLEAR, fill: c(CORP_BLUE.table.surface) } : undefined),
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: "top",
  });
}

// Build a standard data table
function buildTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => tcell(h, { header: true, width: widths ? widths[i] : undefined })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((cellText, ci) => tcell(cellText, {
      zebra: ri % 2 === 1,
      width: widths ? widths[ci] : undefined,
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: c(CORP_BLUE.table.accentLine) },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: c(CORP_BLUE.table.accentLine) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(CORP_BLUE.table.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

// Table title (with keepNext to keep with table)
function tableTitle(text) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    keepNext: true,
    children: [new TextRun({
      text, bold: true, size: 22, color: c(CORP_BLUE.body.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

// ─────────────────────────────────────────────────────────────
// 7. Content — original ASCII diagrams and code (verbatim)
// ─────────────────────────────────────────────────────────────

const ARCH_ASCII = `
+------------------------------------------------------------------------+
|                  3D SYSTEM ARCHITECTURE PERSPECTIVE MAP                |
+------------------------------------------------------------------------+
                                  |
   +------------------------------------------------------------+
   |  PRESENTATION LAYER (Client Access Planes)                  |
   |  +-------------------+  +-------------------+               |
   |  | Farmer App        |  | Field Adjuster    | + Enterprise  |
   |  | (USSD / Mobile)   |  | Native App        | | Web Portal   |
   |  +---------+---------+  +---------+---------+ +---------+----+
   +------------|-----------------------|---------------------|---+
                |                       |                     |
   +------------v-----------------------v---------------------v---+
   |  API GATEWAY LAYER (Edge Routing & Security)                |
   |    * OAuth2 / JWT Auth     * Rate Limiting & GeoIP          |
   |    * TLS 1.3 Traffic Termination                            |
   +------------|-----------------------|---------------------|---+
                |                       |                     |
   +------------v-----------------------v---------------------v---+
   |  CORE MICROSERVICES PLANE (Business Logic & Engine Layer)   |
   |  +-------------------+  +-------------------+  +-----------+ |
   |  | Registration &    |  | Policy &          |  | Dynamic   | |
   |  | Spatial Registry  |  | Underwriting      |  | Loss      | |
   |  | (PostGIS Field    |  | (FAO Ky Actuarial |  | Engine    | |
   |  |  Boundaries)      |  |  Engine)          |  | (Stage x  | |
   |  +---------+---------+  +---------+---------+  |  Depth)   | |
   |            |                      |            +-----+-----+ |
   |  +---------v--------+ +-----------v--------+         |       |
   |  | Satellite Engine | | Weather & Telemetry| +-------v-----+ |
   |  | (Sentinel-2 NDVI | | Oracle             | | Settlement  | |
   |  |  Pipeline)       | | (AWS Rain Gauge)   | | & Disburse  | |
   |  +------------------+ +--------------------+ | Engine      | |
   |                                                   +-----------+ |
   +------------|-----------------------|---------------------|---+
                |                       |                     |
   +------------v-----------------------v---------------------v---+
   |  DATA & MESSAGING PERSISTENCE LAYER                         |
   |  +-------------------+  +-------------------+  +-----------+ |
   |  | PostgreSQL +      |  | Apache Kafka      |  | Redis     | |
   |  | PostGIS           |  | (Telemetry &      |  | Enterprise| |
   |  | (Spatial Tables)  |  |  Claim Stream)    |  | Cache     | |
   |  +-------------------+  +-------------------+  +-----------+ |
   +------------------------------------------------------------+
`;

const WORKFLOW_ASCII = `
[1. Onboarding &       ---> [2. Underwriting &   ---> [3. Oracle Telemetry]
 Registration]               Pricing]                    |
     |                            |                          |
     v                            v                          v
  Farmer KYF +                Satellite Baseline       Continuous NDVI / AWS
  GeoJSON Boundary            Actuarial Ky Matrix      Feeds; Parametric Trigger
  PostGIS Overlap Check       Pricing                  Monitoring
  (ST_Intersects = 0)                                    |
                                                         v
[5. Settlement &      <--  [4. Stage x Depth      <--  [Claims Event Triggered]
 Disburse]                 Loss Assessment]
  Direct Mobile Wallet     Evaluates Stage Sensitivity (Ky)
  Payment                  x Damage Depth Ratio (Dd)
  Instant Reinsurance Audit
`;

const DDL_CODE = `-- Enable Spatial Engine
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Spatial Farm Plot Registry
CREATE TABLE farm_plots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL,
    plot_name VARCHAR(100),
    area_hectares NUMERIC(10, 4) NOT NULL,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,    -- WGS84 Spatial Polygon
    soil_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_valid_polygon CHECK (ST_IsValid(boundary))
);
CREATE INDEX idx_farm_plots_boundary ON farm_plots USING GIST (boundary);

-- 2. Crop Stage Vulnerability Matrix
CREATE TABLE crop_stage_vulnerability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variety_id UUID NOT NULL,
    stage_enum VARCHAR(50) NOT NULL,              -- 'EMERGENCE','VEGETATIVE','FLOWERING','MATURITY'
    start_day_offset INT NOT NULL,
    end_day_offset INT NOT NULL,
    stage_ky_factor NUMERIC(3, 2) NOT NULL,       -- FAO Ky factor (e.g. 1.30 for flowering)
    replant_window_flag BOOLEAN DEFAULT FALSE
);

-- 3. Livestock Asset Biometric Registry
CREATE TABLE livestock_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,                -- 'DAIRY','BEEF','POULTRY','SMALL_RUMINANT'
    unique_tag_id VARCHAR(100) UNIQUE NOT NULL,
    muzzle_print_hash VARCHAR(256),               -- 512-dim embedding vector hash
    declared_value NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Dynamic Claims Evaluation Table
CREATE TABLE insurance_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL,
    asset_type VARCHAR(20) NOT NULL,              -- 'CROP' or 'LIVESTOCK'
    asset_id UUID NOT NULL,
    incident_date DATE NOT NULL,
    growth_stage_at_loss VARCHAR(50),
    damage_depth_ratio NUMERIC(3, 2) NOT NULL,    -- Depth 0.00 to 1.00
    calculated_payout NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'SUBMITTED',
    geotagged_evidence_url TEXT
);`;

const OPENAPI_CODE = `openapi: 3.0.3
info:
  title: Agricultural Insurance - Core API
  version: 1.0.0
paths:
  /api/v1/spatial/plots:
    post:
      summary: Register field polygon boundary
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [farmer_id, plot_name, area_hectares, geojson_boundary]
              properties:
                farmer_id: { type: string, format: uuid }
                plot_name: { type: string }
                area_hectares: { type: number }
                geojson_boundary: { type: object }
      responses:
        '201': { description: Plot registered successfully }
        '409': { description: Spatial overlap collision detected }

  /api/v1/spatial/plots/check-overlap:
    post:
      summary: Evaluate proposed boundary against active registry
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  has_overlap: { type: boolean }
                  overlapping_plot_ids:
                    type: array
                    items: { type: string }`;

const PAYOUT_CODE = `# FAO-Based Dynamic Loss Scoring Algorithm
def calculate_crop_claim_payout(sum_insured: float, input_cost: float, stage: str,
                                damage_depth: float, stage_ky: float, days_sown: int,
                                replant_cutoff: int) -> dict:

    # 1. Early-stage replant cap check
    if stage == "EMERGENCE" or days_sown <= replant_cutoff:
        replant_payout = min(input_cost * damage_depth, sum_insured * 0.25)
        return {"payout": round(replant_payout, 2), "type": "REPLANT_ALLOWANCE"}

    # 2. FAO Stage Sensitivity Factor Scoring
    effective_loss_ratio = min(1.0, max(0.0, damage_depth * stage_ky))
    total_payout = sum_insured * effective_loss_ratio

    return {
        "payout": round(total_payout, 2),
        "type": "FULL_INDEMNITY",
        "loss_severity_ratio": round(effective_loss_ratio, 4)
    }`;

module.exports = {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableLayoutType, SectionType, TableOfContents,
  fs, path,
  CORP_BLUE, c, PG_SIZE, PG_MARGIN_BODY, PG_MARGIN_COVER,
  allNoBorders, noBorders,
  buildCoverR1, h1, h2, h3, p, bullet, codeBlock, caption, tcell, buildTable, tableTitle,
  ARCH_ASCII, WORKFLOW_ASCII, DDL_CODE, OPENAPI_CODE, PAYOUT_CODE,
};

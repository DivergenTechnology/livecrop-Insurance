/**
 * Main entry: assembles the Agricultural Insurance System Implementation Plan.
 */
const lib = require("./gen_agri_insurance.js");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableLayoutType, SectionType, TableOfContents,
  fs, path,
  CORP_BLUE, c, PG_SIZE, PG_MARGIN_BODY, PG_MARGIN_COVER,
  buildCoverR1, h1, h2, h3, p, bullet, codeBlock, caption, buildTable, tableTitle,
  ARCH_ASCII, WORKFLOW_ASCII, DDL_CODE, OPENAPI_CODE, PAYOUT_CODE,
} = lib;

// ─────────────────────────────────────────────────────────────
// Cover config
// ─────────────────────────────────────────────────────────────
const coverConfig = {
  title: "Agricultural Insurance System Implementation Plan",
  subtitle: "Full-Lifecycle Architecture, System Design, Data Models, Business Processes & Testing Approach for Crop & Livestock Insurance",
  englishLabel: "ENTERPRISE AGRICULTURAL INSURANCE PLATFORM",
  metaLines: [
    "Document Version:  2.0  (Regenerated Edition)",
    "Status:            Final  —  Ready for Enterprise Development",
    "Date:              November 2026",
    "Classification:    Internal  —  Enterprise Architecture Office",
  ],
  footerLeft: "Enterprise Architecture Office",
  footerRight: "Lead Systems Architect  |  Agronomic Software Engineering Team",
  palette: CORP_BLUE,
};

// ─────────────────────────────────────────────────────────────
// Front matter: Table of Contents
// ─────────────────────────────────────────────────────────────
function buildFrontMatter() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360 },
      children: [new TextRun({
        text: "Table of Contents",
        bold: true, size: 36, color: c(CORP_BLUE.body.primary),
        font: { ascii: "Calibri", eastAsia: "SimHei" },
      })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({
        text: "Note: This Table of Contents is generated via field codes. To refresh page numbers after editing, right-click the TOC and select \"Update Field\".",
        italics: true, size: 18, color: "888888",
        font: { ascii: "Times New Roman" },
      })],
    }),
    // No PageBreak here — Section 3 is type: NEXT_PAGE which already page-breaks.
    // Adding a PageBreak would cause a blank page between TOC and body.
  ];
}

// ─────────────────────────────────────────────────────────────
// Body content
// ─────────────────────────────────────────────────────────────
function buildBody() {
  const children = [];

  // ===== 1. Executive Summary =====
  children.push(h1("1. Executive Summary"));
  children.push(p("Agricultural production supports millions of households globally but remains exposed to severe climate volatility, biological threats, and micro-climate variability. Conventional insurance systems struggle to protect both smallholder and commercial producers because of exorbitant administrative costs, slow loss-assessment cycles, and pervasive asymmetric information. This Implementation Plan defines an event-driven Agricultural Insurance System for crop and livestock farming that replaces manual field inspections with satellite vegetation telemetry, remote weather sensor arrays, and spatial GIS boundary verification."));
  children.push(p("The platform is built on a multi-tier microservices architecture that combines Sentinel-2 NDVI pipelines, CHIRPS rainfall feeds, PostGIS spatial registries, FAO crop-stage sensitivity coefficients (Ky), and livestock muzzle biometric identity. Together these components automate the full policy lifecycle — onboarding, underwriting, telemetry monitoring, loss assessment, and settlement — and execute parametric payouts through Mobile Money and banking rails. The system addresses four systemic industry failure points: moral hazard, duplicate and overlapping claims, high field-audit transaction costs, and correlated regional risk spikes."));
  children.push(p("Key expected outcomes include a measurable reduction in loss-adjuster dispatches, sub-second spatial overlap detection via ST_Intersects, automated reinsurance audit trails for risk transfer, and parametric payout accuracy validated against Crop Cutting Experiments within a five-percent variance threshold. This document is structured for both executive sponsors and engineering leads: it presents strategic rationale, domain scope, methodology, system architecture, data models, API specifications, payout logic, module decomposition, and the testing approach required for production readiness."));

  // ===== 2. Introduction & Justification =====
  children.push(h1("2. Introduction & Justification"));
  children.push(p("Agricultural production remains the primary economic backbone for millions of households globally, yet it operates in an environment characterized by severe climate volatility, unmanaged biological threats, and extreme microclimate variations. Traditional insurance systems fail to adequately protect smallholder and commercial producers due to exorbitant administrative costs, slow loss assessment cycles, and pervasive asymmetric information. As a result, rural financial ecosystems remain fragile, access to credit stays constrained, and producers absorb climate shocks that erode years of accumulated wealth in a single season."));
  children.push(p("Developing a modernized, event-driven Agricultural Insurance System for crop and livestock farming is therefore essential to safeguard farm livelihoods, stabilize rural financial ecosystems, and facilitate access to credit. By replacing manual field inspections with satellite vegetation index telemetry (Sentinel-2 NDVI), remote weather sensor arrays (CHIRPS), and spatial GIS boundary verification (PostGIS), this system drastically reduces transaction overhead and automates claim disbursements. The platform is engineered to integrate with existing national insurance regulators, mobile money operators, and international reinsurers, providing a production-ready foundation for at-scale deployment across multiple agro-ecological zones."));
  children.push(p("The justification for this investment rests on three converging trends: the maturation of free and open satellite imagery (Sentinel-2 L2A at 10m resolution, refreshed every five days), the ubiquity of mobile money rails in emerging markets (M-Pesa, MTN Mobile Money, Airtel Money), and the falling cost of biometric capture hardware suitable for livestock identification. Combined, these trends make a previously uneconomic insurance model viable at the smallholder scale, where the cost of a single physical loss-adjuster visit could historically exceed the annual premium itself."));

  // ===== 3. Strategic Rationale =====
  children.push(h1("3. Strategic Rationale"));
  children.push(p("The strategic imperative of this system addresses four critical failure points inherent in conventional agricultural underwriting. Each failure point is paired with a specific architectural mechanism that eliminates or mitigates the failure mode."));

  children.push(h2("3.1 Mitigation of Information Asymmetry & Moral Hazard"));
  children.push(p("Once insured, producers may reduce maintenance effort, knowing that losses will be indemnified. This moral hazard is structurally difficult to detect in conventional systems that rely on self-reported claims and periodic physical inspections. By coupling underwriting to real-time satellite vegetation tracking and verified crop-stage sensitivity factors (FAO Ky), the system continuously evaluates physical asset health independently of self-reported claims. NDVI deviations from a baseline trajectory trigger automated investigation workflows long before a claim is filed, shifting the asymmetry from insurer to insured."));

  children.push(h2("3.2 Elimination of Fraud & Overlapping Claims"));
  children.push(p("Farmers frequently submit duplicate claims across multiple insurers for the same field plot, exploiting the absence of a shared spatial registry. The system enforces zero spatial overlap using PostGIS ST_Intersects equal to zero at plot registration time, rejecting any boundary that collides with an existing registered polygon. For livestock, muzzle biometric hashing converts each animal's muzzle print into a 512-dimensional embedding vector, allowing duplicate-tag detection across the registry. Together, these mechanisms make double-insurance economically infeasible and provide an immutable audit trail for regulators."));

  children.push(h2("3.3 Reduction of High Transaction & Field Auditing Costs"));
  children.push(p("Physically dispatching loss adjusters to remote rural areas destroys profit margins, especially for small-ticket policies. Automated parametric triggers execute index-based payouts instantaneously when NDVI or rainfall thresholds are breached, reserving field visits strictly for high-value indemnity exceptions. This inverts the cost structure: rather than paying adjusters per claim, the system pays adjusters only for the small minority of claims that exceed parametric thresholds or require damage-depth verification. The expected reduction in field audit cost is the single largest driver of unit-economics improvement."));

  children.push(h2("3.4 Smoothing Correlated Risk Spikes"));
  children.push(p("Wide-scale regional droughts create systemic claim spikes that can exhaust a single insurer's reserves and threaten solvency. The architecture integrates automated reinsurance audit trail logging at every claim event, capturing the parametric trigger evidence, payout calculation, and asset metadata in a structured event stream. International reinsurers can subscribe to this stream in near real time, allowing seamless risk transfer and dynamic re-pricing of reinsurance treaties. The audit trail also satisfies the data requirements of catastrophe bond issuers, opening an additional risk-transfer channel."));

  // ===== 4. Domain Problem & Scope Analysis =====
  children.push(h1("4. Domain Problem & Scope Analysis"));
  children.push(p("The agricultural insurance domain splits into two foundational branches, each possessing distinct insurable asset classes, peril profiles, and risk calculation mechanics. Treating them as a single domain would produce underwriting errors: crop losses are sensitive to growth stage at the time of stress, while livestock losses are sensitive to epidemic contagion and individual animal identity. The system therefore maintains separate asset registries, separate loss engines, and separate valuation mechanisms, while sharing the common policy, claim, and settlement infrastructure."));

  children.push(tableTitle("Table 1. Domain Comparison — Crop vs. Livestock"));
  children.push(buildTable(
    ["Domain", "Insurable Asset Classes", "Covered Risk Perils", "Valuation & Underwriting Mechanism"],
    [
      ["Crop", "Yield volume; input costs (seeds, fertilizer); export quality grade.",
       "Severe drought; excess rainfall and flooding; unseasonable frost; pest outbreaks; hail.",
       "Parametric Index (NDVI / weather rain-gauge) and Multi-Peril Crop Insurance (MPCI) based on Actual Production History."],
      ["Livestock", "Individual high-value breeding stock; commercial flocks and herds; pastoralist rangeland herds.",
       "Accidental death; epidemic contagions (Avian Flu, African Swine Fever); emergency culling; forage deficiency.",
       "Individual Tagging (RFID / Muzzle Biometrics) and Index-Based Livestock Insurance (IBLI) tracking forage availability."],
    ],
    [12, 28, 28, 32]
  ));
  children.push(caption("Table 1. Foundational comparison of crop and livestock insurance domains."));

  children.push(h2("4.1 Crop Domain Scope"));
  children.push(p("The crop domain insures yield volume, input costs, and export quality grade against severe drought, excess rainfall and flooding, unseasonable frost, pest outbreaks, and hail. Valuation combines a parametric index layer (NDVI or rain-gauge based, with automatic payout when an index breaches a pre-agreed threshold) and a Multi-Peril Crop Insurance (MPCI) layer based on Actual Production History. The parametric layer handles high-frequency low-severity events; the MPCI layer handles low-frequency high-severity events requiring indemnity assessment."));

  children.push(h2("4.2 Livestock Domain Scope"));
  children.push(p("The livestock domain insures individual high-value breeding stock, commercial flocks and herds, and pastoralist rangeland herds against accidental death, epidemic contagions (such as Avian Flu and African Swine Fever), emergency culling, and forage deficiency. Valuation combines individual tagging using RFID and muzzle biometrics for high-value animals, and Index-Based Livestock Insurance (IBLI) that tracks forage availability via NDVI for pastoralist herds where individual tagging is operationally infeasible."));

  // ===== 5. Implementation Methodology =====
  children.push(h1("5. Implementation Methodology"));
  children.push(p("To bridge software engineering sprints with real-world agricultural seasonal timelines, the platform employs a Hybrid Agile-Waterfall Implementation Methodology. The agronomic baseline parameters must be fixed before development begins because they define the actuarial inputs that the software will consume; once fixed, the engineering teams can iterate rapidly on microservices without re-opening agronomic debates. The methodology therefore reserves the Waterfall phase for scientific specification and the Agile phases for software delivery."));

  children.push(tableTitle("Table 2. Hybrid Execution Framework"));
  children.push(buildTable(
    ["Phase", "Type", "Activities", "Exit Criteria"],
    [
      ["Phase A", "Waterfall (Fixed Baseline)",
       "Define FAO Ky parameters per crop variety and stage; define growth-stage timelines; define regional weather index thresholds; validate with agronomy partners.",
       "Signed-off baseline specification document, version-controlled and immutable for the season."],
      ["Phase B", "Scrum (2-Week Sprints)",
       "Iteratively engineer GIS boundary services, biometric registries, telemetry ingestors, payout microservices, and settlement adapters. Continuous integration with automated regression tests.",
       "All five modules pass acceptance tests; OpenAPI contract tests green; performance benchmarks met."],
      ["Phase C", "Seasonal Shadow Pilot (6-Month Growing Cycle)",
       "Execute shadow payouts alongside real-world crop harvest experiments; compare parametric outputs against Crop Cutting Experiments; calibrate Ky factors and thresholds.",
       "Parametric payouts align within five-percent variance of verified Crop Cutting Experiments across at least three agro-ecological zones."],
    ],
    [10, 22, 38, 30]
  ));
  children.push(caption("Table 2. Hybrid Agile-Waterfall execution framework."));

  // ===== 6. System Architecture =====
  children.push(h1("6. System Architecture"));
  children.push(p("The platform follows a multi-tier, event-driven microservices architecture structured into distinct presentation, gateway, core logic, oracle telemetry, and spatial data persistence layers. Each layer is independently deployable, horizontally scalable, and communicates through well-defined RESTful contracts and asynchronous Kafka topics. This separation allows the satellite ingestion pipeline to be scaled independently of the settlement engine during peak harvest periods, and allows the spatial registry to be backed up without coordinating with the biometric service."));

  children.push(h2("6.1 Layered Architecture Overview"));
  children.push(p("The presentation layer exposes three client planes: a Farmer App (USSD and mobile), a Field Adjuster Native App, and an Enterprise Web Portal. All three route through a single API Gateway layer that terminates TLS 1.3, validates OAuth2 / JWT tokens, applies rate limiting and GeoIP policies, and forwards requests to the core microservices plane. The core plane hosts the business logic: Registration and Spatial Registry, Policy and Underwriting (FAO Ky Actuarial Engine), Dynamic Loss Engine, Satellite Engine (Sentinel-2 NDVI), Weather and Telemetry Oracle, and Settlement and Disbursement Engine. The data and messaging persistence layer provides PostgreSQL with PostGIS for spatial tables, Apache Kafka for the telemetry and claim event stream, and Redis for session and boundary caching."));
  children.push(p("The conceptual 3D perspective map below illustrates the layered topology. Each tier is independently deployable, and the data and messaging layer is shared across all core microservices through well-defined schemas and topic contracts."));

  children.push(new Paragraph({
    spacing: { before: 200, after: 80 },
    keepNext: true,
    children: [new TextRun({
      text: "Figure 1. 3D System Architecture Perspective Map",
      bold: true, size: 22, color: c(CORP_BLUE.body.primary),
      font: { ascii: "Calibri" },
    })],
  }));
  children.push(...codeBlock(ARCH_ASCII));

  children.push(h2("6.2 Layer Responsibilities"));
  children.push(tableTitle("Table 3. Architecture Layer Responsibilities"));
  children.push(buildTable(
    ["Layer", "Primary Responsibility", "Key Technologies"],
    [
      ["Presentation", "Provide USSD, mobile, and web entry points for farmers, adjusters, and enterprise users.", "USSD gateway, React Native, React"],
      ["API Gateway", "Terminate TLS, authenticate, rate-limit, route by GeoIP.", "OAuth2, JWT, TLS 1.3, Kong or Apigee"],
      ["Core Microservices", "Execute business logic: registration, underwriting, loss, satellite, weather, settlement.", "Java / Kotlin Spring Boot, Python FastAPI"],
      ["Data & Messaging", "Persist spatial and relational data; stream telemetry and claim events; cache sessions.", "PostgreSQL + PostGIS, Apache Kafka, Redis"],
      ["Telemetry Oracles", "Ingest Sentinel-2 NDVI every 5 days; ingest CHIRPS rainfall feeds continuously.", "Sentinel-2 L2A, CHIRPS, AWS weather feeds"],
    ],
    [22, 48, 30]
  ));
  children.push(caption("Table 3. Architecture layer responsibilities and technology choices."));

  // ===== 7. Business Process & Workflow Engineering =====
  children.push(h1("7. Business Process & Workflow Engineering"));
  children.push(p("The operational lifecycle is divided into five automated process phases, enforcing rigorous digital gateways to eliminate fraud and manual delays. Each phase produces a structured event that is appended to the Kafka claim stream, providing a complete audit trail from onboarding to settlement. The phases are not strictly sequential: oracle telemetry runs continuously in parallel with underwriting and loss assessment, and parametric triggers can fire at any time once a policy is in force."));

  children.push(h2("7.1 Process Flow Diagram"));
  children.push(p("The end-to-end process flow is illustrated below. Phases 1 through 3 run sequentially at policy inception; phases 3 through 5 run concurrently during the coverage period, with phase 4 triggered by either a parametric event or a farmer-filed claim."));
  children.push(...codeBlock(WORKFLOW_ASCII));

  children.push(h2("7.2 Phase Definitions"));
  children.push(tableTitle("Table 4. Business Process Phase Definitions"));
  children.push(buildTable(
    ["Phase", "Primary Inputs", "Controls", "Outputs"],
    [
      ["1. Onboarding & Registration", "Farmer KYF data; GeoJSON boundary polygon.",
       "PostGIS overlap check (ST_Intersects = 0); identity verification.",
       "Registered plot or livestock asset; active farmer record."],
      ["2. Underwriting & Pricing", "Registered asset; declared sum insured; crop variety or livestock category.",
       "Satellite baseline check; actuarial Ky pricing matrix; reinsurance treaty limits.",
       "Issued policy with premium, coverage period, and perils covered."],
      ["3. Oracle Telemetry", "Active policies; Sentinel-2 scenes; CHIRPS rainfall feeds.",
       "Index threshold breaches; parametric trigger rules.",
       "Continuous NDVI and rainfall observations; trigger events when breached."],
      ["4. Loss Assessment", "Trigger event or farmer-filed claim; growth stage at loss; damage depth ratio (Dd).",
       "Stage sensitivity (Ky); damage-depth caps; replant window flags.",
       "Calculated payout, payout type (REPLANT_ALLOWANCE or FULL_INDEMNITY), and audit record."],
      ["5. Settlement & Disburse", "Approved payout; payee wallet or bank account.",
       "Reinsurance audit logging; payment rail SLAs; fraud-screening rules.",
       "Direct mobile wallet or bank payment; reinsurance audit trail; claim closure record."],
    ],
    [22, 26, 26, 26]
  ));
  children.push(caption("Table 4. Five-phase business process — inputs, controls, and outputs."));

  // ===== 8. Database Design & Entity Model =====
  children.push(h1("8. Database Design & Entity Model"));
  children.push(p("The database architecture leverages PostgreSQL with the PostGIS spatial extension. The schema is normalized to third normal form for transactional integrity, with denormalized materialized views added for reporting and dashboard workloads. Spatial columns use the WGS84 coordinate system (SRID 4326) to ensure compatibility with satellite imagery and standard GeoJSON tooling. All primary keys are UUIDs generated server-side to avoid collision risk during multi-region replication."));

  children.push(h2("8.1 Spatial Farm Plot Registry"));
  children.push(p("The farm_plots table registers each insured land parcel as a validated WGS84 polygon. A GIST index on the boundary column enables sub-second spatial overlap queries, and a CHECK constraint enforcing ST_IsValid prevents malformed polygons from entering the registry. The table is the single source of truth for any spatial question about a farmer's land holdings."));

  children.push(h2("8.2 Crop Stage Vulnerability Matrix"));
  children.push(p("The crop_stage_vulnerability table stores FAO Ky sensitivity factors per crop variety and growth stage. Each row defines a stage_enum (EMERGENCE, VEGETATIVE, FLOWERING, MATURITY), a day-offset window, and the stage_ky_factor used by the loss engine to amplify or dampen damage-depth ratios. A replant_window_flag identifies stages where a replant allowance is more appropriate than full indemnity."));

  children.push(h2("8.3 Livestock Asset Biometric Registry"));
  children.push(p("The livestock_assets table registers each insurable animal with a unique RFID or ear-tag identifier and an optional muzzle_print_hash holding a 512-dimensional embedding vector. The unique constraint on unique_tag_id prevents duplicate tags, while the muzzle_print_hash enables near-duplicate detection across the registry using cosine similarity over the embedding vectors."));

  children.push(h2("8.4 Dynamic Claims Evaluation Table"));
  children.push(p("The insurance_claims table captures every claim event, whether triggered by a parametric breach or by a farmer-filed incident. The damage_depth_ratio column stores the measured depth from zero to one, and calculated_payout is populated by the loss engine. The status column drives the workflow state machine (SUBMITTED, ASSESSED, APPROVED, PAID, REJECTED)."));

  children.push(h2("8.5 DDL Statements"));
  children.push(p("The complete DDL for the four core tables is below. All tables include created_at timestamps and UUID primary keys generated by the uuid-ossp extension."));
  children.push(...codeBlock(DDL_CODE));

  // ===== 9. API Specifications =====
  children.push(h1("9. API Specifications"));
  children.push(p("System components interact via RESTful microservices. The OpenAPI 3.0 specification below governs field boundary registration, spatial overlap checks, and the contract that the Farmer App and Field Adjuster App use to submit plot registrations. All endpoints are versioned under /api/v1/ and require a Bearer JWT issued by the API Gateway. The 409 Conflict response on plot registration is the primary fraud-prevention contract: it signals that the proposed boundary collides with an existing registered plot and the request must be rejected or routed to manual review."));

  children.push(h2("9.1 OpenAPI 3.0 Specification"));
  children.push(p("The specification below defines the two spatial-registry endpoints. Additional endpoints for policies, claims, livestock, telemetry, and settlements follow the same patterns and are documented in the full API reference."));
  children.push(...codeBlock(OPENAPI_CODE));

  children.push(h2("9.2 API Design Principles"));
  children.push(p("All endpoints follow four design principles. First, idempotency: every POST accepts an idempotency key in the header so that retried requests do not create duplicate records. Second, versioning: the /api/v1/ prefix is mandatory and breaking changes require a new version. Third, pagination: list endpoints accept cursor-based pagination with a default page size of 100. Fourth, observability: every request carries a trace ID propagated to Kafka events and database queries for end-to-end tracing."));

  // ===== 10. Agronomic Payout Logic =====
  children.push(h1("10. Agronomic Payout Logic"));
  children.push(p("The core underwriting logic calculates claim payouts by dynamically evaluating physical damage depth (Dd) against crop growth stage sensitivity (Ky). The FAO Ky factor captures the empirical observation that crops are not equally sensitive to water stress at all stages: a 30-percent water deficit during flowering causes a much larger yield loss than the same deficit during vegetative growth. By multiplying damage depth by the stage-specific Ky factor, the engine produces an effective loss ratio that better reflects actual agronomic damage than a flat ratio would."));

  children.push(h2("10.1 Payout Formula"));
  children.push(p("The payout formula has two branches. For early-stage losses (EMERGENCE stage, or days_sown less than or equal to the replant cutoff), the engine returns a REPLANT_ALLOWANCE capped at the lower of input_cost multiplied by damage_depth or 25 percent of sum_insured. For all later stages, the engine returns FULL_INDEMNITY equal to sum_insured multiplied by the effective loss ratio, where effective loss ratio equals min(1.0, max(0.0, damage_depth multiplied by stage_ky)). The min and max clamp the ratio to a valid range, preventing negative payouts from sensor noise or over-100-percent payouts from Ky amplification."));

  children.push(h2("10.2 Reference Implementation"));
  children.push(p("The Python reference implementation below is the canonical algorithm. Production deployments reimplement the same logic in the language of the loss engine microservice (typically Java or Kotlin), with the Python version used for offline calibration and shadow-pilot validation."));
  children.push(...codeBlock(PAYOUT_CODE));

  // ===== 11. Implementation Components & Core Modules =====
  children.push(h1("11. Implementation Components & Core Modules"));
  children.push(p("The engineering scope is partitioned into five standalone microservice modules. Each module owns its own database schema, exposes a versioned REST API, and publishes domain events to Kafka. Modules are deployed independently through a continuous delivery pipeline, and cross-module calls are minimized in favor of event-driven choreography."));

  children.push(h2("11.1 Module 1 — Spatial Boundary & Plot Registry"));
  children.push(p("Ingests GeoJSON polygons from the Farmer App and Field Adjuster App, validates spatial validity using ST_IsValid, and enforces zero boundary collisions using ST_Intersects equal to zero against the existing registered plots. The module returns a 409 Conflict response on any collision, providing the overlapping plot identifiers so the calling client can guide the farmer to dispute resolution. Plot boundaries are immutable once registered; corrections require a new plot registration and a soft-delete of the original."));

  children.push(h2("11.2 Module 2 — Livestock Identity & Biometrics Engine"));
  children.push(p("Manages RFID tags and ear-tag identifiers and converts muzzle images into 512-dimensional vector embeddings for duplicate claim identification. The biometric pipeline runs a convolutional encoder on the uploaded muzzle photo, persists the resulting embedding in the livestock_assets table, and runs a cosine-similarity scan against the existing registry to flag potential duplicates above a configurable threshold. The module is also responsible for tag deactivation when an animal is sold, slaughtered, or dies."));

  children.push(h2("11.3 Module 3 — Satellite & Telemetry Oracle Pipeline"));
  children.push(p("Ingests Sentinel-2 satellite imagery every five days, calculates plot-level mean NDVI by intersecting scene pixels with registered plot boundaries, and tracks rainfall telemetry via a Kafka topic subscribed to CHIRPS and AWS rain-gauge feeds. The module writes a continuous observation stream that the parametric trigger engine consumes in near real time. Backfill capabilities allow reprocessing of historical scenes when a new plot is registered mid-season."));

  children.push(h2("11.4 Module 4 — Dynamic Stage x Depth Loss Engine"));
  children.push(p("Houses the agronomic payout algorithms that intersect FAO Ky coefficients with damage depth ratios. The engine receives trigger events from the satellite and weather oracles, fetches the relevant crop stage vulnerability row, and computes the payout according to the formula defined in Section 10. Every payout decision is recorded with its inputs (sum_insured, input_cost, stage, damage_depth, stage_ky, days_sown, replant_cutoff) so that auditors and reinsurers can replay the calculation."));

  children.push(h2("11.5 Module 5 — Settlement & Mobile Payment Rails"));
  children.push(p("Formats payout payloads and executes direct disbursements via Mobile Money APIs (M-Pesa, MTN Mobile Money, Airtel Money) and banking interfaces. The module abstracts each payment rail behind a common adapter interface, handles rail-specific idempotency and retry semantics, and writes a settlement confirmation back to the claim record. Reinsurance audit records are emitted to Kafka at the moment of disbursement, allowing reinsurers to reconcile in near real time."));

  // ===== 12. Comprehensive Testing Approach =====
  children.push(h1("12. Comprehensive Testing Approach"));
  children.push(p("Quality assurance combines rigorous software automated testing with field-level agronomic calibration. The four-tier approach ensures that both the software engineering and the agronomic science are validated before the system is trusted to disburse real payouts. Each tier has explicit acceptance criteria that gate promotion to the next environment."));

  children.push(tableTitle("Table 5. Testing Tiers and Acceptance Criteria"));
  children.push(buildTable(
    ["Test Tier", "Testing Focus & Scope", "Acceptance Criteria Threshold"],
    [
      ["Unit & Integration Testing",
       "Spatial geometry parsing; PostGIS boundary collision queries; Loss Engine math formulas; biometric embedding cosine similarity.",
       "100 percent test pass rate across core actuarial payout algorithms."],
      ["Performance & Load Testing",
       "Kafka telemetry ingest streaming under peak-season load; spatial database query benchmarking at scale.",
       "Spatial query response under 50 ms for 10,000 active spatial plots; Kafka ingest sustains 5,000 events per second."],
      ["Field Offline Sync Testing",
       "Adjuster mobile client offline audit caching and auto-sync on re-connection in low-connectivity rural environments.",
       "Zero data loss when synchronizing 500 queued offline field audit files; conflict resolution rules verified."],
      ["Shadow Pilot Validation",
       "Parallel execution of parametric triggers alongside actual crop harvesting across multiple agro-ecological zones.",
       "Parametric payouts align within 5-percent variance of verified Crop Cutting Experiments across at least three zones."],
    ],
    [22, 48, 30]
  ));
  children.push(caption("Table 5. Four-tier testing approach with acceptance criteria."));

  children.push(h2("12.1 Continuous Integration"));
  children.push(p("All four tiers are integrated into the continuous delivery pipeline. Unit and integration tests run on every pull request. Performance tests run nightly against a staging environment populated with a synthetic 10,000-plot dataset. Field offline sync tests run on a weekly schedule against physical low-connectivity test devices. Shadow pilot validation runs continuously during the growing season, with calibration reviews at the end of each crop cycle."));

  // ===== 13. Conclusions & Sign-Off =====
  children.push(h1("13. Conclusions & Sign-Off"));
  children.push(p("This implementation plan provides a complete, production-ready blueprint for deploying an Agricultural Insurance System for crop and livestock farming. By uniting spatial PostGIS GIS boundary indexing, satellite remote sensing telemetry (NDVI), livestock muzzle biometrics, and dynamic Stage x Depth loss scoring, the platform resolves systemic industry challenges around moral hazard, adverse selection, and administrative cost. The hybrid Agile-Waterfall methodology aligns software delivery cadence with agronomic seasonal cycles, and the four-tier testing approach provides the evidence base required for regulatory approval and reinsurer onboarding."));
  children.push(p("The four strategic failure points — moral hazard, fraud and overlapping claims, high transaction and field-auditing costs, and correlated risk spikes — are each addressed by a specific architectural mechanism that is traceable from the strategic rationale in Section 3 through to the implementation modules in Section 11 and the testing approach in Section 12. This traceability is the basis for the production-ready claim and for the sign-off below."));

  children.push(h2("13.1 Document Approval & Sign-Off"));
  children.push(p("Prepared by: Lead Systems Architect & Agronomic Software Engineering Team."));
  children.push(p("Status: Fully Detailed — Ready for Enterprise Development."));
  children.push(p("Approval signatures: 【Sign-off: Lead Systems Architect】 【Sign-off: Head of Agronomy】 【Sign-off: Chief Risk Officer】."));

  return children;
}

// ─────────────────────────────────────────────────────────────
// Footers
// ─────────────────────────────────────────────────────────────
function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          children: [PageNumber.CURRENT],
          size: 18, color: "808080",
          font: { ascii: "Times New Roman" },
        })],
      }),
    ],
  });
}

function makeHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "Agricultural Insurance System — Implementation Plan",
          size: 18, color: "808080",
          font: { ascii: "Times New Roman" },
        })],
      }),
    ],
  });
}

// ─────────────────────────────────────────────────────────────
// Assemble document
// ─────────────────────────────────────────────────────────────
const doc = new Document({
  creator: "Enterprise Architecture Office",
  title: "Agricultural Insurance System Implementation Plan",
  description: "Regenerated implementation plan v2.0",
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "Times New Roman" },
          size: 24, color: c(CORP_BLUE.body.text),
        },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(CORP_BLUE.body.primary) },
        paragraph: { spacing: { before: 360, after: 180, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(CORP_BLUE.body.primary) },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(CORP_BLUE.body.primary) },
        paragraph: { spacing: { before: 220, after: 110, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // Section 1: Cover — margin 0, no page number, no header/footer
    {
      properties: {
        page: { size: PG_SIZE, margin: PG_MARGIN_COVER },
      },
      children: buildCoverR1(coverConfig),
    },
    // Section 2: Front matter (TOC) — Roman numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: PG_SIZE, margin: PG_MARGIN_BODY,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: buildFrontMatter(),
    },
    // Section 3: Body — Arabic numerals starting at 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: PG_SIZE, margin: PG_MARGIN_BODY,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: buildBody(),
    },
  ],
});

// ─────────────────────────────────────────────────────────────
// Write file
// ─────────────────────────────────────────────────────────────
const OUT_DIR = "/home/z/my-project/download";
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, "Agricultural_Insurance_System_Implementation_Plan.docx");

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT_FILE, buf);
  console.log("Wrote:", OUT_FILE, "(" + buf.length + " bytes)");
}).catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});

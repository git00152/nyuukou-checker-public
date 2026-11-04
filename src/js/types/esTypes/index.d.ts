/**
 * Build-time stub for ExtendScript exported function types.
 * At runtime, evalTS resolves against the actual bundled ExtendScript (src/jsx/index.ts).
 * During the TSC type-check step (tsconfig-build.json), src/jsx is excluded to avoid
 * Adobe-specific global type errors (PathItem, Layer, etc.).
 * This stub satisfies the @esTypes/index import in bolt.ts while keeping full type safety
 * for the CEP/React layer.
 */

interface ScopeInfo {
  bounds: [number, number, number, number];
  hasIncompleteMarks: boolean;
  scopeSource?: "trim-marks" | "artboard" | "fallback";
  confidence?: "high" | "medium" | "low";
  trimMarkGapPt?: number;
  requiredBleedPt?: number;
  requirementSource?: "explicit" | "default" | "unknown";
  normalInspectionBounds?: [number, number, number, number];
  notes?: string[];
  sideCoverage?: { [side: string]: { status: "satisfied" | "insufficient" | "unknown" | "not-applicable"; intervals: BleedInterval[] } };
}

export interface BleedInterval {
  startPt: number;
  endPt: number;
  status: "satisfied" | "insufficient" | "unknown";
  measuredPt?: number;
  targetKeys: string[];
}

export interface ArtboardDescriptor {
  index: number;
  name: string;
  rect: [number, number, number, number];
}

export interface CheckResult {
  severity: "ERROR" | "WARNING" | "INFO";
  messageKey: string;
  message: string;
  id?: string;
  objectName?: string;
  layerName?: string;
  bounds?: [number, number, number, number];
  targetRef?: CheckTargetRef;
  actions?: CheckResultAction[];
}

export interface CheckTargetRef {
  kind: "pathItem" | "textFrame" | "placedItem" | "rasterItem" | "swatch";
  messageKey?: string;
  layerName?: string;
  objectName?: string;
  swatchName?: string;
  bounds?: [number, number, number, number];
  collectionIndex?: number;
  signature?: string;
  documentKey?: string;
  inspectionEpoch?: string;
  scanId?: string;
  artboardIndex?: number;
  artboardFingerprint?: string;
}

export interface CheckResultAction {
  id: "select" | "delete" | "cleanup";
  label: string;
  destructive?: boolean;
}

export interface RunAllResult {
  results: CheckResult[];
  scopeInfo: ScopeInfo;
  noDocument?: boolean;
}

export interface ArtboardHostState {
  artboards: ArtboardDescriptor[];
  activeArtboardIndex: number;
  documentKey: string;
  inspectionEpoch: string;
  artboardsFingerprint: string;
  noDocument?: boolean;
}

export interface ArtboardRunResult extends RunAllResult {
  artboardIndex: number;
  scanId: string;
  documentKey: string;
  inspectionEpoch: string;
  artboardFingerprint: string;
}

export interface ArtboardPreviewResult {
  filePath: string;
  artboardBounds: [number, number, number, number];
}

export interface Scripts {
  runAll(opts?: {
    colorWorkflow?: "cmyk" | "rgb";
    largePrintMode?: boolean;
    detectOpenPaths?: boolean;
    detectFilledOpenPaths?: boolean;
    includeGuides?: boolean;
    includeTrimMarkLayers?: boolean;
    artboardIndex?: number;
    includeDocumentWideChecks?: boolean;
    includeSavedVersionCheck?: boolean;
    requiredBleedPt?: number;
  }): RunAllResult;
  getArtboards(): ArtboardHostState;
  runArtboardCheck(index: number, opts?: {
    largePrintMode?: boolean;
    detectOpenPaths?: boolean;
    detectFilledOpenPaths?: boolean;
    includeTrimMarkLayers?: boolean;
    requiredBleedPt?: number;
  }): ArtboardRunResult | RunAllResult & { noDocument: true };
  exportArtboardPreview(index?: number, scanId?: string): ArtboardPreviewResult | string;
  selectCheckTarget(targetRef: CheckTargetRef): { ok: boolean; reason?: string };
  deleteCheckTarget(targetRef: CheckTargetRef): { ok: boolean; deletedCount?: number; failedCount?: number; reason?: string };
  cleanupCheckTargets(messageKey: string, targetRefs: CheckTargetRef[]): { ok: boolean; deletedCount?: number; failedCount?: number; reason?: string };
  [key: string]: (...args: unknown[]) => unknown;
}

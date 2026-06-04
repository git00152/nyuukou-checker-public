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
}

export interface CheckResultAction {
  id: "select" | "delete" | "cleanup";
  label: string;
  destructive?: boolean;
}

export interface RunAllResult {
  results: CheckResult[];
  scopeInfo: ScopeInfo;
}

export interface ArtboardPreviewResult {
  filePath: string;
  artboardBounds: [number, number, number, number];
}

export interface Scripts {
  runAll(opts?: {
    largePrintMode?: boolean;
    detectOpenPaths?: boolean;
    detectFilledOpenPaths?: boolean;
    includeGuides?: boolean;
    includeTrimMarkLayers?: boolean;
  }): RunAllResult;
  exportArtboardPreview(): ArtboardPreviewResult | string;
  selectCheckTarget(targetRef: CheckTargetRef): { ok: boolean; reason?: string };
  deleteCheckTarget(targetRef: CheckTargetRef): { ok: boolean; deletedCount?: number; failedCount?: number; reason?: string };
  cleanupCheckTargets(messageKey: string, targetRefs: CheckTargetRef[]): { ok: boolean; deletedCount?: number; failedCount?: number; reason?: string };
  [key: string]: (...args: unknown[]) => unknown;
}

export interface CheckResult {
  severity: "ERROR" | "WARNING" | "INFO";
  messageKey: string;
  message: string;
  id?: string;
  objectName?: string;
  layerName?: string;
  bounds?: [number, number, number, number]; // geometricBounds [left, top, right, bottom] Illustrator 座標系
  targetRef?: CheckTargetRef;
  actions?: CheckResultAction[];
}

export interface ArtboardDescriptor {
  index: number;
  name: string;
  rect: [number, number, number, number];
}

export interface ScopeInfo {
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

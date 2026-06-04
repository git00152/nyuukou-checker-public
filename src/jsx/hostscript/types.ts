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

export interface ScopeInfo {
  bounds: [number, number, number, number];
  hasIncompleteMarks: boolean;
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

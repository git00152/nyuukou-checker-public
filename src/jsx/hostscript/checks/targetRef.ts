import type { CheckResultAction, CheckTargetRef } from "../types";

export type PathItemTargetLike = {
  closed?: boolean;
  filled?: boolean;
  stroked?: boolean;
  strokeWidth?: number;
  pathPoints?: { length: number } | unknown[];
  name?: string;
  layer?: { name?: string };
  geometricBounds?: [number, number, number, number];
};

export type TextFrameTargetLike = {
  contents?: string;
  name?: string;
  layer?: { name?: string };
  geometricBounds?: [number, number, number, number];
};

export type ImageItemTargetLike = {
  typename?: string;
  name?: string;
  layer?: { name?: string };
  geometricBounds?: [number, number, number, number];
  file?: { fsName?: string };
};

export function toBounds(gb: [number, number, number, number] | number[] | undefined): [number, number, number, number] | undefined {
  if (!gb || gb.length < 4) return undefined;
  return [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
}

function num(value: unknown): string {
  return typeof value === "number" && isFinite(value) ? value.toFixed(3) : "";
}

export function getPathPointCount(item: PathItemTargetLike): number {
  try {
    return item.pathPoints ? item.pathPoints.length : -1;
  } catch (e) {
    return -1;
  }
}

export function getPathItemLayerName(item: PathItemTargetLike): string {
  try {
    return item.layer && item.layer.name ? item.layer.name : "";
  } catch (e) {
    return "";
  }
}

export function createPathItemSignature(item: PathItemTargetLike, bounds?: [number, number, number, number]): string {
  var b = bounds || toBounds(item.geometricBounds);
  var parts = [
    "closed=" + String(item.closed === true),
    "filled=" + String(item.filled === true),
    "stroked=" + String(item.stroked === true),
    "strokeWidth=" + num(item.strokeWidth),
    "pathPoints=" + String(getPathPointCount(item)),
  ];
  if (b) {
    parts.push("bounds=" + num(b[0]) + "," + num(b[1]) + "," + num(b[2]) + "," + num(b[3]));
  }
  return parts.join("|");
}

export function createPathItemTargetRef(
  item: PathItemTargetLike,
  messageKey: string,
  collectionIndex: number,
  bounds?: [number, number, number, number],
): CheckTargetRef {
  var targetBounds = bounds || toBounds(item.geometricBounds);
  return {
    kind: "pathItem",
    messageKey: messageKey,
    layerName: getPathItemLayerName(item),
    objectName: item.name || "",
    bounds: targetBounds,
    collectionIndex: collectionIndex,
    signature: createPathItemSignature(item, targetBounds),
  };
}

export function createSwatchTargetRef(swatchName: string, messageKey: string, collectionIndex: number): CheckTargetRef {
  return {
    kind: "swatch",
    messageKey: messageKey,
    swatchName: swatchName,
    collectionIndex: collectionIndex,
    signature: "swatchName=" + swatchName,
  };
}

export function createTextFrameSignature(item: TextFrameTargetLike, bounds?: [number, number, number, number]): string {
  var b = bounds || toBounds(item.geometricBounds);
  var parts = [
    "textFrame=true",
  ];
  if (b) {
    parts.push("bounds=" + num(b[0]) + "," + num(b[1]) + "," + num(b[2]) + "," + num(b[3]));
  }
  return parts.join("|");
}

export function createTextFrameTargetRef(
  item: TextFrameTargetLike,
  messageKey: string,
  collectionIndex: number,
  bounds?: [number, number, number, number],
): CheckTargetRef {
  var targetBounds = bounds || toBounds(item.geometricBounds);
  return {
    kind: "textFrame",
    messageKey: messageKey,
    layerName: getPathItemLayerName(item),
    objectName: item.name || "",
    bounds: targetBounds,
    collectionIndex: collectionIndex,
    signature: createTextFrameSignature(item, targetBounds),
  };
}

export function createImageItemSignature(item: ImageItemTargetLike, bounds?: [number, number, number, number]): string {
  var b = bounds || toBounds(item.geometricBounds);
  var filePath = "";
  try {
    filePath = item.file && item.file.fsName ? item.file.fsName : "";
  } catch (e) {
    filePath = "";
  }
  var parts = [
    "typename=" + String(item.typename || ""),
    "file=" + filePath,
  ];
  if (b) {
    parts.push("bounds=" + num(b[0]) + "," + num(b[1]) + "," + num(b[2]) + "," + num(b[3]));
  }
  return parts.join("|");
}

export function createImageItemTargetRef(
  item: ImageItemTargetLike,
  messageKey: string,
  collectionIndex: number,
  bounds?: [number, number, number, number],
): CheckTargetRef {
  var targetBounds = bounds || toBounds(item.geometricBounds);
  var kind = item.typename === "RasterItem" ? "rasterItem" : "placedItem";
  return {
    kind: kind,
    messageKey: messageKey,
    layerName: getPathItemLayerName(item),
    objectName: item.name || "",
    bounds: targetBounds,
    collectionIndex: collectionIndex,
    signature: createImageItemSignature(item, targetBounds),
  };
}

export const SELECT_ACTION: CheckResultAction = { id: "select", label: "編集画面で選択" };
export const DELETE_ACTION: CheckResultAction = { id: "delete", label: "削除", destructive: true };
export const CLEANUP_ACTION: CheckResultAction = { id: "cleanup", label: "この項目をすべて削除", destructive: true };

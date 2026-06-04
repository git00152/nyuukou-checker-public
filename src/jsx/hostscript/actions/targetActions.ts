import type { CheckTargetRef } from "../types";
import { collectPathItems, collectPlacedItems, collectRasterItems, collectTextFrames } from "../inspector";
import { collectUsedSpotNames, DocumentForSwatches, SYSTEM_SWATCH_NAMES } from "../checks/checkUnusedSwatches";
import { createImageItemSignature, createPathItemSignature, createTextFrameSignature, getPathItemLayerName, getPathPointCount, toBounds } from "../checks/targetRef";

export type TargetActionReason =
  | "NO_DOCUMENT"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "LOCKED"
  | "UNSUPPORTED_TARGET"
  | "INVALID_TARGET_REF"
  | "STILL_IN_USE"
  | "SYSTEM_SWATCH"
  | "REMOVE_FAILED";

export interface TargetActionResult {
  ok: boolean;
  deletedCount?: number;
  failedCount?: number;
  reason?: TargetActionReason;
}

type PathItemActionLike = PathItem & {
  selected?: boolean;
  locked?: boolean;
  hidden?: boolean;
  editable?: boolean;
  remove?: () => void;
};

type TextFrameActionLike = TextFrame & {
  selected?: boolean;
  locked?: boolean;
  hidden?: boolean;
  editable?: boolean;
  textRange?: { select?: () => void };
};

type ImageItemActionLike = PageItem & {
  typename?: string;
  selected?: boolean;
  locked?: boolean;
  hidden?: boolean;
  editable?: boolean;
  file?: { fsName?: string };
};

type SelectableActionLike = PathItemActionLike | TextFrameActionLike | ImageItemActionLike;

function getActiveDocument(): Document | null {
  try {
    return app.activeDocument;
  } catch (e) {
    return null;
  }
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

function boundsMatch(a?: [number, number, number, number], b?: [number, number, number, number]): boolean {
  if (!a || !b) return true;
  return nearlyEqual(a[0], b[0]) && nearlyEqual(a[1], b[1]) && nearlyEqual(a[2], b[2]) && nearlyEqual(a[3], b[3]);
}

function isSelectable(item: SelectableActionLike): boolean {
  try {
    if (item.locked === true || item.hidden === true || item.editable === false) return false;
    return true;
  } catch (e) {
    return true;
  }
}

function pathCandidateMatches(item: PathItemActionLike, ref: CheckTargetRef): boolean {
  if (ref.layerName && getPathItemLayerName(item) !== ref.layerName) return false;
  if (ref.objectName && String((item as unknown as { name?: string }).name || "") !== ref.objectName) return false;
  var gb = toBounds((item as unknown as { geometricBounds?: [number, number, number, number] }).geometricBounds);
  if (!boundsMatch(gb, ref.bounds)) return false;
  if (ref.signature && createPathItemSignature(item, gb) !== ref.signature) return false;
  return true;
}

function findPathItem(doc: Document, ref: CheckTargetRef): { item?: PathItemActionLike; reason?: TargetActionReason } {
  if (ref.kind !== "pathItem") return { reason: "UNSUPPORTED_TARGET" };
  if (!ref.messageKey) return { reason: "INVALID_TARGET_REF" };
  var items = collectPathItems(doc) as unknown as PathItemActionLike[];
  var matches: PathItemActionLike[] = [];

  if (typeof ref.collectionIndex === "number" && items[ref.collectionIndex]) {
    var indexed = items[ref.collectionIndex];
    if (pathCandidateMatches(indexed, ref)) {
      matches.push(indexed);
    }
  }

  if (matches.length === 0) {
    for (var i = 0; i < items.length; i++) {
      if (pathCandidateMatches(items[i], ref)) {
        matches.push(items[i]);
      }
    }
  }

  if (matches.length === 0) return { reason: "NOT_FOUND" };
  if (matches.length > 1) return { reason: "AMBIGUOUS" };
  return { item: matches[0] };
}

function textFrameCandidateMatches(item: TextFrameActionLike, ref: CheckTargetRef): boolean {
  if (ref.layerName && getPathItemLayerName(item) !== ref.layerName) return false;
  if (ref.objectName && String((item as unknown as { name?: string }).name || "") !== ref.objectName) return false;
  var gb = toBounds((item as unknown as { geometricBounds?: [number, number, number, number] }).geometricBounds);
  if (!boundsMatch(gb, ref.bounds)) return false;
  if (ref.signature && createTextFrameSignature(item, gb) !== ref.signature) return false;
  return true;
}

function findTextFrame(doc: Document, ref: CheckTargetRef): { item?: TextFrameActionLike; reason?: TargetActionReason } {
  if (ref.kind !== "textFrame") return { reason: "UNSUPPORTED_TARGET" };
  if (!ref.messageKey) return { reason: "INVALID_TARGET_REF" };
  var items = collectTextFrames(doc) as unknown as TextFrameActionLike[];
  var matches: TextFrameActionLike[] = [];

  if (typeof ref.collectionIndex === "number" && items[ref.collectionIndex]) {
    var indexed = items[ref.collectionIndex];
    if (textFrameCandidateMatches(indexed, ref)) {
      matches.push(indexed);
    }
  }

  if (matches.length === 0) {
    for (var i = 0; i < items.length; i++) {
      if (textFrameCandidateMatches(items[i], ref)) {
        matches.push(items[i]);
      }
    }
  }

  if (matches.length === 0) return { reason: "NOT_FOUND" };
  if (matches.length > 1) return { reason: "AMBIGUOUS" };
  return { item: matches[0] };
}

function imageItemCandidateMatches(item: ImageItemActionLike, ref: CheckTargetRef): boolean {
  if (ref.layerName && getPathItemLayerName(item) !== ref.layerName) return false;
  if (ref.objectName && String((item as unknown as { name?: string }).name || "") !== ref.objectName) return false;
  var gb = toBounds((item as unknown as { geometricBounds?: [number, number, number, number] }).geometricBounds);
  if (!boundsMatch(gb, ref.bounds)) return false;
  if (ref.signature && createImageItemSignature(item, gb) !== ref.signature) return false;
  return true;
}

function findImageItem(doc: Document, ref: CheckTargetRef): { item?: ImageItemActionLike; reason?: TargetActionReason } {
  if (ref.kind !== "placedItem" && ref.kind !== "rasterItem") return { reason: "UNSUPPORTED_TARGET" };
  if (!ref.messageKey) return { reason: "INVALID_TARGET_REF" };
  var items = ref.kind === "rasterItem"
    ? collectRasterItems(doc) as unknown as ImageItemActionLike[]
    : collectPlacedItems(doc) as unknown as ImageItemActionLike[];
  var matches: ImageItemActionLike[] = [];

  if (typeof ref.collectionIndex === "number" && items[ref.collectionIndex]) {
    var indexed = items[ref.collectionIndex];
    if (imageItemCandidateMatches(indexed, ref)) {
      matches.push(indexed);
    }
  }

  if (matches.length === 0) {
    for (var i = 0; i < items.length; i++) {
      if (imageItemCandidateMatches(items[i], ref)) {
        matches.push(items[i]);
      }
    }
  }

  if (matches.length === 0) return { reason: "NOT_FOUND" };
  if (matches.length > 1) return { reason: "AMBIGUOUS" };
  return { item: matches[0] };
}

function findSwatch(doc: Document, ref: CheckTargetRef): { swatch?: { name: string; remove?: () => void }; reason?: TargetActionReason } {
  if (ref.kind !== "swatch") return { reason: "UNSUPPORTED_TARGET" };
  if (!ref.swatchName || !ref.messageKey) return { reason: "INVALID_TARGET_REF" };
  var swatches = (doc as unknown as DocumentForSwatches).swatches;
  if (!swatches) return { reason: "NOT_FOUND" };
  var found: Array<{ name: string; remove?: () => void }> = [];
  for (var i = 0; i < swatches.length; i++) {
    if (swatches[i].name === ref.swatchName) {
      found.push(swatches[i] as unknown as { name: string; remove?: () => void });
    }
  }
  if (found.length === 0) return { reason: "NOT_FOUND" };
  if (found.length > 1) return { reason: "AMBIGUOUS" };
  return { swatch: found[0] };
}

function isUnusedSwatch(doc: Document, swatchName: string): boolean {
  var used = collectUsedSpotNames(doc as unknown as DocumentForSwatches);
  return used[swatchName] !== true;
}

export function selectCheckTarget(targetRef: CheckTargetRef): TargetActionResult {
  var doc = getActiveDocument();
  if (!doc) return { ok: false, reason: "NO_DOCUMENT" };
  if (!targetRef) return { ok: false, reason: "UNSUPPORTED_TARGET" };

  var found = targetRef.kind === "textFrame"
    ? findTextFrame(doc, targetRef)
    : targetRef.kind === "placedItem" || targetRef.kind === "rasterItem"
      ? findImageItem(doc, targetRef)
      : findPathItem(doc, targetRef);
  if (!found.item) return { ok: false, reason: found.reason || "NOT_FOUND" };
  if (!isSelectable(found.item)) return { ok: false, reason: "LOCKED" };

  try {
    try {
      app.executeMenuCommand("deselectall");
    } catch (_e1) {
      doc.selection = null;
    }
    found.item.selected = true;
    try {
      doc.selection = [found.item] as unknown as typeof doc.selection;
    } catch (_e2) {
      // Some Illustrator item types accept only selected=true.
    }
    if (targetRef.kind === "textFrame") {
      try {
        var textFrame = found.item as TextFrameActionLike;
        if (textFrame.textRange && typeof textFrame.textRange.select === "function") {
          textFrame.textRange.select();
        }
      } catch (_e3) {
        // Object-level selected=true remains the primary selection path.
      }
    }
    app.redraw();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "LOCKED" };
  }
}

export function deleteCheckTarget(targetRef: CheckTargetRef): TargetActionResult {
  var doc = getActiveDocument();
  if (!doc) return { ok: false, reason: "NO_DOCUMENT", deletedCount: 0, failedCount: 1 };
  if (!targetRef || !targetRef.messageKey) return { ok: false, reason: "INVALID_TARGET_REF", deletedCount: 0, failedCount: 1 };

  if (targetRef.kind === "pathItem" && targetRef.messageKey === "PATH_STRAY_01") {
    var foundPath = findPathItem(doc, targetRef);
    if (!foundPath.item) return { ok: false, reason: foundPath.reason || "NOT_FOUND", deletedCount: 0, failedCount: 1 };
    if (!isSelectable(foundPath.item)) return { ok: false, reason: "LOCKED", deletedCount: 0, failedCount: 1 };
    if (getPathPointCount(foundPath.item) !== 1) return { ok: false, reason: "INVALID_TARGET_REF", deletedCount: 0, failedCount: 1 };
    try {
      foundPath.item.remove();
      return { ok: true, deletedCount: 1, failedCount: 0 };
    } catch (e) {
      return { ok: false, reason: "REMOVE_FAILED", deletedCount: 0, failedCount: 1 };
    }
  }

  if (targetRef.kind === "swatch" && targetRef.messageKey === "COLOR_UNUSED_SWATCH_01") {
    if (!targetRef.swatchName) return { ok: false, reason: "INVALID_TARGET_REF", deletedCount: 0, failedCount: 1 };
    if (SYSTEM_SWATCH_NAMES[targetRef.swatchName]) return { ok: false, reason: "SYSTEM_SWATCH", deletedCount: 0, failedCount: 1 };
    var foundSwatch = findSwatch(doc, targetRef);
    if (!foundSwatch.swatch) return { ok: false, reason: foundSwatch.reason || "NOT_FOUND", deletedCount: 0, failedCount: 1 };
    if (!isUnusedSwatch(doc, targetRef.swatchName)) return { ok: false, reason: "STILL_IN_USE", deletedCount: 0, failedCount: 1 };
    try {
      if (typeof foundSwatch.swatch.remove !== "function") return { ok: false, reason: "REMOVE_FAILED", deletedCount: 0, failedCount: 1 };
      foundSwatch.swatch.remove();
      return { ok: true, deletedCount: 1, failedCount: 0 };
    } catch (e) {
      return { ok: false, reason: "REMOVE_FAILED", deletedCount: 0, failedCount: 1 };
    }
  }

  return { ok: false, reason: "UNSUPPORTED_TARGET", deletedCount: 0, failedCount: 1 };
}

export function cleanupCheckTargets(messageKey: string, targetRefs: CheckTargetRef[]): TargetActionResult {
  if (!targetRefs || targetRefs.length === 0) return { ok: false, reason: "INVALID_TARGET_REF", deletedCount: 0, failedCount: 0 };
  var deletedCount = 0;
  var failedCount = 0;
  var reason: TargetActionReason | undefined;

  for (var i = 0; i < targetRefs.length; i++) {
    if (!targetRefs[i] || targetRefs[i].messageKey !== messageKey) {
      failedCount++;
      reason = reason || "INVALID_TARGET_REF";
      continue;
    }
    var result = deleteCheckTarget(targetRefs[i]);
    if (result.ok) {
      deletedCount += result.deletedCount || 1;
    } else {
      failedCount += result.failedCount || 1;
      reason = reason || result.reason;
    }
  }

  return {
    ok: failedCount === 0,
    deletedCount: deletedCount,
    failedCount: failedCount,
    reason: failedCount === 0 ? undefined : reason,
  };
}

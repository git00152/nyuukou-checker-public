import type { CheckResult, ScopeInfo, BleedInterval } from "../types";
import { BLEED_PT } from "../utils/coordinateUtils";
import { createImageItemTargetRef, createPathItemTargetRef } from "./targetRef";

export interface BleedCheckItem {
  typename?: string;
  name: string;
  filled?: boolean;
  fillColor?: unknown;
  geometricBounds: [number, number, number, number];
  closed?: boolean;
  clipping?: boolean;
  opacity?: number;
  hidden?: boolean;
  parent?: unknown;
  pathPoints?: { length: number; [index: number]: { anchor: number[]; leftDirection: number[]; rightDirection: number[] } };
}
export interface BleedCoverageOptions { requiredBleedPt?: number; largePrintMode?: boolean; }
type Candidate = { index: number; start: number; end: number; depth: number; proven: boolean };
var EPS = 0.1;

// Images need pixel alpha evidence; placement bounds alone do not prove coverage.
function isProvenRectangle(item: BleedCheckItem): boolean {
  try {
    if (item.typename !== "PathItem" || item.closed !== true || item.filled !== true || item.clipping === true || item.opacity !== 100) return false;
    var fill = item.fillColor as { typename?: string } | undefined;
    if (!fill || (fill.typename !== "CMYKColor" && fill.typename !== "RGBColor" && fill.typename !== "GrayColor" && fill.typename !== "SpotColor")) return false;
    var parent = item.parent as { typename?: string; parent?: unknown; opacity?: number; clipped?: boolean; hidden?: boolean; visible?: boolean } | undefined;
    var depth = 0;
    while (parent && depth++ < 64) {
      if (parent.typename === "CompoundPathItem" || parent.clipped === true || parent.hidden === true || parent.visible === false) return false;
      if (parent.typename === "GroupItem" && parent.opacity !== 100) return false;
      if (parent.typename === "Document") break;
      parent = parent.parent as typeof parent;
    }
    if (depth >= 64) return false;
    var points = item.pathPoints, b = item.geometricBounds;
    if (!points || points.length !== 4) return false;
    var seen: { [key: string]: boolean } = {};
    for (var i = 0; i < 4; i++) {
      var p = points[i], a = p.anchor, next = points[(i + 1) % 4].anchor;
      if (a[0] !== p.leftDirection[0] || a[1] !== p.leftDirection[1] || a[0] !== p.rightDirection[0] || a[1] !== p.rightDirection[1]) return false;
      if ((a[0] !== b[0] && a[0] !== b[2]) || (a[1] !== b[1] && a[1] !== b[3])) return false;
      if (a[0] !== next[0] && a[1] !== next[1]) return false;
      var key = String(a[0]) + "," + String(a[1]);
      if (seen[key]) return false;
      seen[key] = true;
    }
    return true;
  } catch (_) { return false; }
}

export function checkBleedCoverage(items: BleedCheckItem[], scope: ScopeInfo, options?: BleedCoverageOptions): CheckResult[] {
  var results: CheckResult[] = [];
  var value = options && typeof options.requiredBleedPt === "number" ? options.requiredBleedPt : scope.requiredBleedPt;
  var valid = typeof value === "number" && isFinite(value) && value >= 0;
  var source = scope.requirementSource || (typeof value === "number" ? "explicit" : "default");
  if (typeof value === "number" && !valid) source = "unknown";
  var required = valid ? value as number : BLEED_PT;
  var sides = ["left", "top", "right", "bottom"];
  var candidates: Candidate[][] = [[], [], [], []];
  var itemStatus: { [index: string]: "unknown" | "insufficient" } = {};
  var finish = scope.bounds;
  scope.sideCoverage = {};
  for (var i = 0; i < items.length; i++) {
    var item = items[i], b = item.geometricBounds;
    var color = item.fillColor as { typename?: string } | undefined;
    if (item.hidden === true || item.opacity === 0) continue;
    if (item.typename !== "PlacedItem" && item.typename !== "RasterItem" && (item.filled === false || !color || color.typename === "NoColor")) continue;
    if (!b || !isFinite(b[0]) || !isFinite(b[1]) || !isFinite(b[2]) || !isFinite(b[3])) {
      results.push({ severity: "INFO", messageKey: "CHECK_FAILED", message: "Bleed: invalid bounds", objectName: item.name });
      continue;
    }
    var proven = isProvenRectangle(item);
    for (var s = 0; s < 4; s++) {
      var vertical = s === 0 || s === 2, line = finish[s];
      var crosses = vertical ? b[0] <= line && b[2] >= line : b[3] <= line && b[1] >= line;
      var start = vertical ? Math.max(b[3], finish[3]) : Math.max(b[0], finish[0]);
      var end = vertical ? Math.min(b[1], finish[1]) : Math.min(b[2], finish[2]);
      if (!crosses || end <= start) continue;
      var reach = s === 0 ? finish[0] - b[0] : s === 1 ? b[1] - finish[1] : s === 2 ? b[2] - finish[2] : finish[3] - b[3];
      candidates[s].push({ index: i, start: start, end: end, depth: reach, proven: proven });
    }
  }
  for (var s = 0; s < 4; s++) {
    var list = candidates[s], cuts: number[] = [], intervals: BleedInterval[] = [];
    for (var c = 0; c < list.length; c++) { cuts.push(list[c].start); cuts.push(list[c].end); }
    cuts.sort(function (a, b) { return a - b; });
    var sideStatus: "not-applicable" | "satisfied" | "insufficient" | "unknown" = "not-applicable";
    for (var j = 1; j < cuts.length; j++) {
      if (cuts[j] <= cuts[j - 1]) continue;
      var maxDepth = -1, uncertain = false, owners: Candidate[] = [], keys: string[] = [];
      for (var c = 0; c < list.length; c++) {
        var candidate = list[c];
        if (candidate.start > cuts[j - 1] || candidate.end < cuts[j]) continue;
        owners.push(candidate); keys.push(String(candidate.index));
        if (candidate.proven) maxDepth = Math.max(maxDepth, candidate.depth);
        else uncertain = true;
      }
      if (!owners.length) continue;
      var status: "satisfied" | "insufficient" | "unknown";
      if (source === "unknown" || scope.scopeSource === "fallback" || (scope.confidence && scope.confidence !== "high")) status = "unknown";
      else if (maxDepth + EPS >= required && maxDepth >= 0) status = "satisfied";
      else status = uncertain ? "unknown" : "insufficient";
      intervals.push({ startPt: cuts[j - 1], endPt: cuts[j], status: status, measuredPt: maxDepth >= 0 ? maxDepth : undefined, targetKeys: keys });
      if (sideStatus === "not-applicable" || status === "insufficient" || (status === "unknown" && sideStatus !== "insufficient")) sideStatus = status;
      if (status !== "satisfied") {
        for (var o = 0; o < owners.length; o++) {
          var ownerKey = String(owners[o].index);
          if (itemStatus[ownerKey] !== "insufficient") itemStatus[ownerKey] = status;
        }
      }
    }
    scope.sideCoverage[sides[s]] = { status: sideStatus, intervals: intervals };
  }
  for (var i = 0; i < items.length; i++) {
    var problem = itemStatus[String(i)];
    if (!problem) continue;
    var item = items[i], gb = item.geometricBounds;
    var bounds: [number, number, number, number] = [gb[0], gb[1], gb[2], gb[3]];
    var info = problem === "unknown" || (source === "default" && options && options.largePrintMode === true);
    var ref = item.typename === "PlacedItem" || item.typename === "RasterItem"
      ? createImageItemTargetRef(item, "BLEED_COVERAGE_01", i, bounds)
      : createPathItemTargetRef(item, "BLEED_COVERAGE_01", i, bounds);
    results.push({ severity: info ? "INFO" : "WARNING", messageKey: "BLEED_COVERAGE_01",
      message: problem === "unknown" ? "塗り足し要確認: 実形状または要求値を確定できません。" : "塗り足し不足: 仕上がり線に接する対象区間が要求値（" + (Math.round(required * 25.4 / 72 * 10) / 10) + "mm）に届いていません。",
      objectName: item.name, bounds: bounds, targetRef: ref });
  }
  return results;
}

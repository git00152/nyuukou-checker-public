import type { CheckResult, ScopeInfo } from "../types";
import { isOutsideBleedZone } from "../utils/coordinateUtils";
import { createImageItemTargetRef, createPathItemTargetRef } from "./targetRef";

export interface BleedCheckItem {
  typename?: string;
  name: string;
  fillColor?: unknown;
  geometricBounds: [number, number, number, number];
}

function createBleedTargetRef(item: BleedCheckItem, collectionIndex: number, bounds: [number, number, number, number]) {
  if (item.typename === "PlacedItem" || item.typename === "RasterItem") {
    return createImageItemTargetRef(item, "BLEED_COVERAGE_01", collectionIndex, bounds);
  }
  return createPathItemTargetRef(item, "BLEED_COVERAGE_01", collectionIndex, bounds);
}

function needsBleed(item: BleedCheckItem): boolean {
  if (item.typename === "PlacedItem" || item.typename === "RasterItem") return true;
  const color = item.fillColor;
  const c = color as { typename?: string } | null | undefined;
  if (!c) return false;
  return c.typename !== "NoColor";
}

export function checkBleedCoverage(items: BleedCheckItem[], scope: ScopeInfo): CheckResult[] {
  const results: CheckResult[] = [];
  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!needsBleed(item)) continue;
    if (isOutsideBleedZone(item.geometricBounds, scope.bounds)) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = item.geometricBounds;
      const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
      results.push({
        severity: "WARNING",
        messageKey: "BLEED_COVERAGE_01",
        message: "\u5857\u308A\u8DB3\u3057\u4E0D\u8DB3: \"" + item.name + "\" \u304C\u30A2\u30FC\u30C8\u30DC\u30FC\u30C9\u5916\u5074 3mm \u306E\u5857\u308A\u8DB3\u3057\u9818\u57DF\u306B\u5230\u9054\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u65AD\u88C1\u6642\u306B\u767D\u30D5\u30C1\u304C\u51FA\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002",
        objectName: item.name,
        bounds,
        targetRef: createBleedTargetRef(item, i, bounds),
      });
    }
  }
  return results;
}

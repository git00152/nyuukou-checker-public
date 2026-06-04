import type { CheckResult } from "../types";
import { CLEANUP_ACTION, createSwatchTargetRef, DELETE_ACTION } from "./targetRef";

// CONTEXT.md ロック: システムスウォッチ除外・名前ベース比較・INFO レベル
// ExtendScript 互換: Set は ExtendScript（ES3）に存在しないため plain object で代用する
export const SYSTEM_SWATCH_NAMES: Record<string, boolean> = {
  "[None]": true,
  "[Registration]": true,
  "White": true,
  "Black": true,
  "CMYK Red": true,
  "CMYK Yellow": true,
  "CMYK Green": true,
  "Registration": true,
};

interface SwatchLike {
  name: string;
}

interface ColorLike {
  typename: string;
  spot?: { name: string };
}

interface PageItemLike {
  typename: string;
  fillColor?: unknown;
  strokeColor?: unknown;
}

export interface DocumentForSwatches {
  swatches: SwatchLike[];
  allPageItems: unknown[];
}

function extractSpotName(color: unknown): string | null {
  const c = color as ColorLike;
  if (c?.typename === "SpotColor" && c.spot?.name) {
    return c.spot.name;
  }
  return null;
}

// ExtendScript 互換: Set は ExtendScript（ES3）に存在しないため plain object で代用する
export function collectUsedSpotNames(doc: DocumentForSwatches): Record<string, boolean> {
  const used: Record<string, boolean> = {};
  // ExtendScript 互換: doc.allPageItems は Illustrator ネイティブコレクション。
  // for...of は Symbol.iterator に依存するため使用不可。インデックスループを使用する。
  const allItems = doc.allPageItems;
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i] as PageItemLike;
    const fillName = extractSpotName(item.fillColor);
    if (fillName) used[fillName] = true;
    const strokeName = extractSpotName(item.strokeColor);
    if (strokeName) used[strokeName] = true;
  }
  return used;
}

export function checkUnusedSwatches(doc: DocumentForSwatches): CheckResult[] {
  // allPageItems が取得できない場合（古い Illustrator 等）はスキャン不能のため空を返す
  if (!doc.allPageItems) return [];
  const results: CheckResult[] = [];
  const usedNames = collectUsedSpotNames(doc);

  // ExtendScript 互換: doc.swatches は Illustrator ネイティブコレクション。
  // for...of は Symbol.iterator に依存するため使用不可。インデックスループを使用する。
  const swatches = doc.swatches;
  for (let i = 0; i < swatches.length; i++) {
    const swatch = swatches[i];
    // システムスウォッチは除外
    if (SYSTEM_SWATCH_NAMES[swatch.name]) continue;

    // 使用済みでない場合は INFO
    if (!usedNames[swatch.name]) {
      results.push({
        id: "COLOR_UNUSED_SWATCH_01:" + i,
        severity: "INFO",
        messageKey: "COLOR_UNUSED_SWATCH_01",
        message: "\u672A\u4F7F\u7528\u306E\u30B9\u30A6\u30A9\u30C3\u30C1\u304C\u5B58\u5728\u3057\u307E\u3059: \"" + swatch.name + "\" \u2014 \u5165\u7A3F\u524D\u306B\u524A\u9664\u3059\u308B\u3053\u3068\u3092\u304A\u52E7\u3081\u3057\u307E\u3059",
        objectName: swatch.name,
        targetRef: createSwatchTargetRef(swatch.name, "COLOR_UNUSED_SWATCH_01", i),
        actions: [DELETE_ACTION, CLEANUP_ACTION],
      });
    }
  }

  return results;
}

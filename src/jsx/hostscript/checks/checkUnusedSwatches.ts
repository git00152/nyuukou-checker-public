import type { CheckResult } from "../types";
import { createSwatchTargetRef } from "./targetRef";

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
  color?: unknown;
}

interface ColorLike {
  typename: string;
  spot?: { name: string };
  gradient?: { gradientStops?: { length: number; [key: number]: { color?: unknown } } };
}

interface PageItemLike {
  typename: string;
  fillColor?: unknown;
  strokeColor?: unknown;
}

interface CharacterLike {
  fillColor?: unknown;
  strokeColor?: unknown;
}

interface TextFrameLike {
  characters?: { length: number; [key: number]: CharacterLike };
}

export interface DocumentForSwatches {
  swatches: SwatchLike[];
  allPageItems: unknown[];
  /** ライブテキストの文字色を走査するために使用する（省略可） */
  textFrames?: unknown;
}

/**
 * 色から参照されている特色名を used に登録する。
 * グラデーションの場合は分岐点の色を再帰的に確認する。
 */
function markSpotNames(color: unknown, used: Record<string, boolean>, depth: number): void {
  if (!color || depth > 3) return;
  var c: ColorLike;
  try {
    c = color as ColorLike;
    if (c.typename === "SpotColor" && c.spot && c.spot.name) {
      used[c.spot.name] = true;
      return;
    }
    if (c.typename === "GradientColor" && c.gradient && c.gradient.gradientStops) {
      var stops = c.gradient.gradientStops;
      for (var i = 0; i < stops.length; i++) {
        markSpotNames(stops[i] ? stops[i].color : null, used, depth + 1);
      }
    }
  } catch (e) {
    // 取得できない色は無視する
  }
}

function getLength(collection: unknown): number {
  try {
    var len = (collection as { length?: unknown }).length;
    return typeof len === "number" ? len : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * ドキュメント内で使用されている特色名を収集する。
 * 対象: オブジェクトの塗り・線、グラデーション分岐点、ライブテキストの文字色、グラデーションスウォッチの分岐点。
 * パターン・シンボル・アピアランスの追加塗りは API から判定できないため対象外。
 */
export function collectUsedSpotNames(doc: DocumentForSwatches): Record<string, boolean> {
  const used: Record<string, boolean> = {};
  const allItems = doc.allPageItems || [];
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i] as PageItemLike;
    if (!item) continue;
    try { markSpotNames(item.fillColor, used, 0); } catch (e) { /* ignore */ }
    try { markSpotNames(item.strokeColor, used, 0); } catch (e) { /* ignore */ }
  }

  const frames = doc.textFrames as { [key: number]: TextFrameLike } | undefined;
  const frameCount = getLength(frames);
  for (let f = 0; f < frameCount; f++) {
    var chars: TextFrameLike["characters"] | undefined;
    try {
      chars = (frames as { [key: number]: TextFrameLike })[f].characters;
    } catch (e) {
      chars = undefined;
    }
    const charCount = getLength(chars);
    for (let ci = 0; ci < charCount; ci++) {
      try {
        const ch = (chars as { [key: number]: CharacterLike })[ci];
        markSpotNames(ch.fillColor, used, 0);
        markSpotNames(ch.strokeColor, used, 0);
      } catch (e) {
        // 文字属性が取得できない場合は無視する
      }
    }
  }

  const swatches = doc.swatches || [];
  for (let s = 0; s < swatches.length; s++) {
    try {
      const sc = swatches[s].color as ColorLike | undefined;
      if (sc && sc.typename === "GradientColor") markSpotNames(sc, used, 0);
    } catch (e) {
      // ignore
    }
  }
  return used;
}

function isSpotSwatch(swatch: SwatchLike): boolean {
  try {
    const c = swatch.color as ColorLike | undefined;
    return !!c && c.typename === "SpotColor";
  } catch (e) {
    return false;
  }
}

/**
 * 未使用の特色スウォッチを INFO として報告する。
 * 削除アクションは付けない（アピアランスの追加塗り・パターン・シンボル内の使用を判定できず、
 * 使用中の特色を削除するとプロセスカラーに変換される事故につながるため）。
 * 整理は Illustrator のスウォッチパネルメニュー「未使用項目を選択」で行う。
 */
export function checkUnusedSwatches(doc: DocumentForSwatches): CheckResult[] {
  if (!doc.allPageItems) return [];
  const results: CheckResult[] = [];
  const usedNames = collectUsedSpotNames(doc);

  const swatches = doc.swatches;
  for (let i = 0; i < swatches.length; i++) {
    const swatch = swatches[i];
    if (SYSTEM_SWATCH_NAMES[swatch.name]) continue;
    if (!isSpotSwatch(swatch)) continue;

    if (!usedNames[swatch.name]) {
      results.push({
        id: "COLOR_UNUSED_SWATCH_01:" + i,
        severity: "INFO",
        messageKey: "COLOR_UNUSED_SWATCH_01",
        message: "\u672A\u4F7F\u7528\u306E\u53EF\u80FD\u6027\u304C\u3042\u308B\u7279\u8272\u30B9\u30A6\u30A9\u30C3\u30C1: \"" + swatch.name + "\" \u2014 \u30B9\u30A6\u30A9\u30C3\u30C1\u30D1\u30CD\u30EB\u306E\u300C\u672A\u4F7F\u7528\u9805\u76EE\u3092\u9078\u629E\u300D\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044",
        objectName: swatch.name,
        targetRef: createSwatchTargetRef(swatch.name, "COLOR_UNUSED_SWATCH_01", i),
      });
    }
  }

  return results;
}

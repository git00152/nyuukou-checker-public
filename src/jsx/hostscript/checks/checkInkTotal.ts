import type { CheckResult } from "../types";
import { createPathItemTargetRef } from "./targetRef";

export interface CMYKColorLike {
  typename: "CMYKColor";
  cyan: number; // 0.0-100.0
  magenta: number;
  yellow: number;
  black: number;
}

export interface InkCheckItem {
  typename?: string; // "PlacedItem" / "RasterItem" は除外対象
  name: string;
  fillColor: unknown;
  strokeColor: unknown;
  geometricBounds?: [number, number, number, number];
  clipping?: boolean; // クリッピングマスクの場合は true（除外対象）
}

function isCmyk(color: unknown): color is CMYKColorLike {
  return (color as CMYKColorLike)?.typename === "CMYKColor";
}

function checkColor(
  item: InkCheckItem,
  color: unknown,
  kind: "\u5857\u308A" | "\u7DDA",
  collectionIndex: number
): CheckResult[] {
  if (!isCmyk(color)) return [];
  const cyan = color.cyan;
  const magenta = color.magenta;
  const yellow = color.yellow;
  const black = color.black;
  const results: CheckResult[] = [];
  const displayName = item.name || "\uff08\u540d\u79f0\u306a\u3057\uff09";
  const gb = item.geometricBounds;
  const total = cyan + magenta + yellow + black;
  if (total > 350) {
    const r: CheckResult = {
      severity: "WARNING",
      messageKey: "COLOR_INK_TOTAL_01",
      message: "CMYK \u5408\u8A08\u5024\u304C " + total.toFixed(1) + "%\uFF08350% \u8D85\uFF09: \"" + displayName + "\" \u306E" + kind,
      objectName: displayName,
    };
    if (gb) { r.bounds = [gb[0], gb[1], gb[2], gb[3]]; }
    r.targetRef = createPathItemTargetRef(item, "COLOR_INK_TOTAL_01", collectionIndex, r.bounds);
    results.push(r);
  }
  // ExtendScript (ES3) 互換: Number.isInteger は ES6 のため存在しない。
  // Illustrator の CMYK 値は浮動小数点誤差で 5.000000000001 のような値になることがある。
  // Math.round との差が 0.01 以上の場合のみ「小数点あり」とみなす。
  const hasDecimal =
    Math.abs(cyan - Math.round(cyan)) >= 0.01 ||
    Math.abs(magenta - Math.round(magenta)) >= 0.01 ||
    Math.abs(yellow - Math.round(yellow)) >= 0.01 ||
    Math.abs(black - Math.round(black)) >= 0.01;
  if (hasDecimal) {
    const r: CheckResult = {
      severity: "INFO",
      messageKey: "COLOR_INK_DECIMAL_01",
      message: "CMYK \u5024\u306B\u5C0F\u6570\u70B9\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059: \"" + displayName + "\" \u306E" + kind + " (C:" + cyan + " M:" + magenta + " Y:" + yellow + " K:" + black + ")",
      objectName: displayName,
    };
    if (gb) { r.bounds = [gb[0], gb[1], gb[2], gb[3]]; }
    r.targetRef = createPathItemTargetRef(item, "COLOR_INK_DECIMAL_01", collectionIndex, r.bounds);
    results.push(r);
  }
  return results;
}

export function checkInkTotal(items: InkCheckItem[]): CheckResult[] {
  const results: CheckResult[] = [];
  // ExtendScript (ES3) 互換: for...of と スプレッド演算子は使用不可。
  // インデックスループと push で代替する。
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // リンク画像・埋め込み画像はインク量チェック対象外
    if (item.typename === "PlacedItem" || item.typename === "RasterItem") continue;
    // クリッピングマスクパス（画像の境界を定義するパス）はスキップ
    if (item.clipping) continue;
    const fillResults = checkColor(item, item.fillColor, "\u5857\u308A", i);
    for (let j = 0; j < fillResults.length; j++) {
      results.push(fillResults[j]);
    }
    const strokeResults = checkColor(item, item.strokeColor, "\u7DDA", i);
    for (let j = 0; j < strokeResults.length; j++) {
      results.push(strokeResults[j]);
    }
  }
  return results;
}

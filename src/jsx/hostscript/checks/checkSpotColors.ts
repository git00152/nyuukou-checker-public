import type { CheckResult } from "../types";
import { createPathItemTargetRef } from "./targetRef";

interface ColorLike {
  typename: string;
  cyan?: number;
  magenta?: number;
  yellow?: number;
  black?: number;
  spot?: { name?: string };
}

export interface SpotColorItem {
  name: string;
  fillColor: unknown;
  strokeColor: unknown;
  geometricBounds?: [number, number, number, number];
}

function isSpotColor(color: unknown): boolean {
  return (color as ColorLike)?.typename === "SpotColor";
}

function isRegistrationColor(color: unknown): boolean {
  const c = color as ColorLike | null | undefined;
  if (!c) return false;
  if (c.typename === "RegistrationColor") return true;
  // CMYK 100/100/100/100 はレジストレーションカラーと同等として除外
  if (
    c.typename === "CMYKColor" &&
    c.cyan === 100 &&
    c.magenta === 100 &&
    c.yellow === 100 &&
    c.black === 100
  ) return true;
  // SpotColor でスポット名に "registration" または日本語の "レジストレーション" を含む場合も除外
  // 大文字小文字・角括弧の有無・日本語ロケール差異を吸収するため indexOf で部分一致
  if (c.typename === "SpotColor" && c.spot) {
    const spotName = (c.spot.name || "").toLowerCase();
    // 英語: "registration", "[registration]" 等
    if (spotName.indexOf("registration") !== -1) return true;
    // 日本語: "レジストレーション" (indexOf で部分一致)
    // ExtendScript 互換: 文字列リテラル比較は toLowerCase() 後に行う（toLowerCase はカタカナに影響しない）
    if (c.spot.name && c.spot.name.indexOf("\u30EC\u30B8\u30B9\u30C8\u30EC\u30FC\u30B7\u30E7\u30F3") !== -1) return true;
  }
  return false;
}

function checkColorForSpot(
  item: SpotColorItem,
  color: unknown,
  collectionIndex: number
): CheckResult | null {
  // RegistrationColor（トンボ用）は除外
  if (isRegistrationColor(color)) return null;
  if (isSpotColor(color)) {
    const displayName = item.name || "\uff08\u540d\u79f0\u306a\u3057\uff09";
    const gb = item.geometricBounds;
    const result: CheckResult = {
      severity: "WARNING",
      messageKey: "COLOR_SPOT_01",
      message: "\u30B9\u30DD\u30C3\u30C8\u30AB\u30E9\u30FC\u304C\u4F7F\u7528\u3055\u308C\u3066\u3044\u307E\u3059: \"" + displayName + "\" \u2014 \u5370\u5237\u8A2D\u5B9A\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044",
      objectName: displayName,
    };
    if (gb) {
      result.bounds = [gb[0], gb[1], gb[2], gb[3]];
    }
    result.targetRef = createPathItemTargetRef(item, "COLOR_SPOT_01", collectionIndex, result.bounds);
    return result;
  }
  return null;
}

export function checkSpotColors(items: SpotColorItem[]): CheckResult[] {
  const results: CheckResult[] = [];
  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fillResult = checkColorForSpot(item, item.fillColor, i);
    if (fillResult) results.push(fillResult);

    const strokeResult = checkColorForSpot(item, item.strokeColor, i);
    if (strokeResult) results.push(strokeResult);
  }
  return results;
}

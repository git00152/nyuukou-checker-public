import type { CheckResult } from "../types";
import { createPathItemTargetRef } from "./targetRef";

export interface OverprintItem {
  name: string;
  fillColor: unknown;
  strokeColor: unknown;
  fillOverprint: boolean;
  strokeOverprint: boolean;
  geometricBounds?: [number, number, number, number];
}

interface CMYKColorLike {
  typename: "CMYKColor";
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
}

function isCmyk(c: unknown): c is CMYKColorLike {
  return (c as CMYKColorLike)?.typename === "CMYKColor";
}

function isK100Black(c: unknown): boolean {
  if (!isCmyk(c)) return false;
  return c.cyan === 0 && c.magenta === 0 && c.yellow === 0 && c.black === 100;
}

function isWhite(c: unknown): boolean {
  if (!isCmyk(c)) return false;
  return c.cyan === 0 && c.magenta === 0 && c.yellow === 0 && c.black === 0;
}

function checkColorOverprint(
  item: OverprintItem,
  color: unknown,
  overprint: boolean,
  kind: "\u5857\u308A" | "\u7DDA",
  collectionIndex: number
): CheckResult[] {
  if (!overprint) return [];
  if (isK100Black(color)) return []; // 除外: K100% 黒は業界標準
  const gb = item.geometricBounds;
  const bounds = gb ? [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number] : undefined;
  if (isWhite(color)) {
    return [
      {
        severity: "ERROR",
        messageKey: "COLOR_OVERPRINT_WHITE_01",
        message: "\u767D\uFF080%\uFF09\u306E" + kind + "\u306B\u30AA\u30FC\u30D0\u30FC\u30D7\u30EA\u30F3\u30C8\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059: \"" + item.name + "\" \u2014 \u767D\u304C\u6D88\u3048\u308B\u5370\u5237\u4E8B\u6545\u306E\u539F\u56E0\u306B\u306A\u308A\u307E\u3059",
        objectName: item.name,
        bounds,
        targetRef: createPathItemTargetRef(item, "COLOR_OVERPRINT_WHITE_01", collectionIndex, bounds),
      },
    ];
  }
  return [
    {
      severity: "WARNING",
      messageKey: "COLOR_OVERPRINT_01",
      message: "\u610F\u56F3\u3057\u306A\u3044" + kind + "\u306E\u30AA\u30FC\u30D0\u30FC\u30D7\u30EA\u30F3\u30C8\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059: \"" + item.name + "\"",
      objectName: item.name,
      bounds,
      targetRef: createPathItemTargetRef(item, "COLOR_OVERPRINT_01", collectionIndex, bounds),
    },
  ];
}

export function checkOverprint(items: OverprintItem[]): CheckResult[] {
  const results: CheckResult[] = [];
  // ExtendScript (ES3) 互換: for...of とスプレッド演算子は使用不可。
  // インデックスループと push で代替する。
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const fillR = checkColorOverprint(item, item.fillColor, item.fillOverprint, "\u5857\u308A", i);
      for (let j = 0; j < fillR.length; j++) { results.push(fillR[j]); }
      const strokeR = checkColorOverprint(item, item.strokeColor, item.strokeOverprint, "\u7DDA", i);
      for (let j = 0; j < strokeR.length; j++) { results.push(strokeR[j]); }
    } catch {
      // TextFrame 等 fillOverprint 取得失敗は無視
    }
  }
  return results;
}

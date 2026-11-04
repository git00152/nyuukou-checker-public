import type { CheckResult } from "./types";

/**
 * 入稿プロファイルのカラーワークフロー。
 * cmyk: 一般的な CMYK 入稿（既定）
 * rgb:  RGB 入稿（グラフィック社の RGB 印刷など。sRGB / Adobe RGB）
 */
export type ColorWorkflow = "cmyk" | "rgb";

/**
 * プロファイルごとに結果から除外する messageKey。
 * チェック内容そのものが変わるもの（ドキュメント/画像のカラーモード）は各チェッカーが
 * colorWorkflow を受け取って判定し、意味を持たなくなるものだけをここで除外する。
 */
export const PROFILE_DISABLED_MESSAGE_KEYS: Record<ColorWorkflow, string[]> = {
  cmyk: [],
  // インキ総量・CMYK 小数点は RGB 入稿では意味を持たない
  rgb: ["COLOR_INK_TOTAL_01", "COLOR_INK_DECIMAL_01"],
};

export function applyProfileRules(results: CheckResult[], colorWorkflow?: ColorWorkflow): CheckResult[] {
  const disabled = PROFILE_DISABLED_MESSAGE_KEYS[colorWorkflow === "rgb" ? "rgb" : "cmyk"];
  if (disabled.length === 0) return results;
  // ExtendScript (ES3) 互換: Array.prototype.filter / indexOf on arrays は使用しない
  const filtered: CheckResult[] = [];
  for (let i = 0; i < results.length; i++) {
    let isDisabled = false;
    for (let k = 0; k < disabled.length; k++) {
      if (results[i].messageKey === disabled[k]) { isDisabled = true; break; }
    }
    if (!isDisabled) filtered.push(results[i]);
  }
  return filtered;
}

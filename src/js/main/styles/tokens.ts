import type { CheckResult } from "../../../jsx/hostscript/types";

/**
 * パネルの UI 色は panel.css の CSS 変数（Illustrator のテーマ追従）で管理する。
 * ここに残すのは、アートボード（白い印刷面）の上に描くオーバーレイ用の固定色だけ。
 */
export const colors = {
  artboardBg: "#ffffff",
};

export const svgSeverityColors: Record<CheckResult["severity"], string> = {
  ERROR: "#e53e3e",
  WARNING: "#d69e2e",
  INFO: "#3182ce",
};

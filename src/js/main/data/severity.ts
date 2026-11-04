import type { CheckResult } from "../../../jsx/hostscript/types";

export type Severity = CheckResult["severity"];

export const SEVERITIES: Severity[] = ["ERROR", "WARNING", "INFO"];

/**
 * 画面上の重要度の呼び方。内部の severity 値（ERROR / WARNING / INFO）と messageKey は変えない。
 * 「入稿前にどう扱うか」で呼ぶ。
 */
export const SEVERITY_LABEL: Record<Severity, string> = {
  ERROR: "要修正",
  WARNING: "要確認",
  INFO: "参考",
};

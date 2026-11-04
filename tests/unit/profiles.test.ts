import { describe, it, expect } from "vitest";
import { applyProfileRules, PROFILE_DISABLED_MESSAGE_KEYS } from "../../src/jsx/hostscript/profiles";
import type { CheckResult } from "../../src/jsx/hostscript/types";

const make = (messageKey: string): CheckResult => ({ severity: "WARNING", messageKey, message: messageKey });

describe("applyProfileRules", () => {
  it("cmyk プロファイルでは結果をそのまま返す", () => {
    const results = [make("COLOR_INK_TOTAL_01"), make("COLOR_INK_DECIMAL_01"), make("PATH_THIN_LINE_01")];
    expect(applyProfileRules(results, "cmyk")).toEqual(results);
  });

  it("colorWorkflow 未指定は cmyk として扱う", () => {
    const results = [make("COLOR_INK_TOTAL_01")];
    expect(applyProfileRules(results, undefined)).toEqual(results);
  });

  it("rgb プロファイルではインキ総量・CMYK 小数点の結果を除外する", () => {
    const results = [make("COLOR_INK_TOTAL_01"), make("PATH_THIN_LINE_01"), make("COLOR_INK_DECIMAL_01")];
    const filtered = applyProfileRules(results, "rgb");
    expect(filtered.map((r) => r.messageKey)).toEqual(["PATH_THIN_LINE_01"]);
  });

  it("rgb プロファイルの除外対象は CMYK 固有のチェックに限定される", () => {
    expect(PROFILE_DISABLED_MESSAGE_KEYS.rgb).toEqual(["COLOR_INK_TOTAL_01", "COLOR_INK_DECIMAL_01"]);
    expect(PROFILE_DISABLED_MESSAGE_KEYS.cmyk).toEqual([]);
  });
});

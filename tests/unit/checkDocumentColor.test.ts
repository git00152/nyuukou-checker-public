import { describe, it, expect } from "vitest";
import { checkDocumentColor } from "../../src/jsx/hostscript/checks/checkDocumentColor";

describe("checkDocumentColor", () => {
  it("COLOR-01: documentColorSpace が RGB を含む場合 ERROR / COLOR_DOC_MODE_01 を返す", () => {
    const doc = { documentColorSpace: "DocumentColorSpace.RGB" };
    const results = checkDocumentColor(doc);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("COLOR_DOC_MODE_01");
  });

  it("COLOR-01: documentColorSpace が CMYK を含む場合 空配列を返す（OK）", () => {
    const doc = { documentColorSpace: "DocumentColorSpace.CMYK" };
    const results = checkDocumentColor(doc);
    expect(results).toHaveLength(0);
  });

  it("COLOR-01: documentColorSpace が数値定数（1 など）の場合でも文字列変換して判定する", () => {
    // CMYK 文字列を含まない数値は非 CMYK として ERROR
    const doc = { documentColorSpace: 2 };
    const results = checkDocumentColor(doc);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("COLOR_DOC_MODE_01");
  });

  it("COLOR-01: documentColorSpace が undefined の場合 ERROR を返す（CMYK でないとみなす）", () => {
    const doc = { documentColorSpace: undefined };
    const results = checkDocumentColor(doc);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("COLOR_DOC_MODE_01");
  });
});

import { describe, it, expect } from "vitest";
import { getMessageDetail, MessageDetail } from "../../src/js/main/data/messages";

describe("getMessageDetail", () => {
  // === PATH ===
  it("PATH_EMPTY_01 のエントリを返す", () => {
    const detail = getMessageDetail("PATH_EMPTY_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("PATH_STRAY_01 のエントリを返す", () => {
    const detail = getMessageDetail("PATH_STRAY_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("PATH_THIN_LINE_01 のエントリを返す", () => {
    const detail = getMessageDetail("PATH_THIN_LINE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("PATH_OVERFLOW_01 のエントリを返す", () => {
    const detail = getMessageDetail("PATH_OVERFLOW_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  // === TEXT ===
  it("TEXT_LIVE_01 のエントリを返す", () => {
    const detail = getMessageDetail("TEXT_LIVE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  // === LAYER ===
  it("LAYER_HIDDEN_01 のエントリを返す", () => {
    const detail = getMessageDetail("LAYER_HIDDEN_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("LAYER_HIDDEN_OBJ_01 のエントリを返す", () => {
    const detail = getMessageDetail("LAYER_HIDDEN_OBJ_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  // === IMG ===
  it("IMG_RESOLUTION_LOW_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_RESOLUTION_LOW_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_RESOLUTION_WARN_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_RESOLUTION_WARN_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_RESOLUTION_LARGE_PRINT_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_RESOLUTION_LARGE_PRINT_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_LINK_BROKEN_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_LINK_BROKEN_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_COLOR_SPACE_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_COLOR_SPACE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_COLOR_SPACE_MANUAL_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_COLOR_SPACE_MANUAL_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_RASTER_EFFECT_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_RASTER_EFFECT_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("IMG_RESOLUTION_UNKNOWN_01 のエントリを返す", () => {
    const detail = getMessageDetail("IMG_RESOLUTION_UNKNOWN_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  // === COLOR ===
  it("COLOR_DOC_MODE_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_DOC_MODE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("COLOR_INK_TOTAL_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_INK_TOTAL_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("COLOR_INK_DECIMAL_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_INK_DECIMAL_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("COLOR_OVERPRINT_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_OVERPRINT_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("COLOR_OVERPRINT_WHITE_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_OVERPRINT_WHITE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("COLOR_UNUSED_SWATCH_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_UNUSED_SWATCH_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("COLOR_SPOT_01 のエントリを返す", () => {
    const detail = getMessageDetail("COLOR_SPOT_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  // === BLEED ===
  it("BLEED_COVERAGE_01 のエントリを返す", () => {
    const detail = getMessageDetail("BLEED_COVERAGE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("BLEED_SAFE_ZONE_01 のエントリを返す", () => {
    const detail = getMessageDetail("BLEED_SAFE_ZONE_01");
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  // === FALLBACK ===
  it("未知の messageKey に対して fallback オブジェクトを返す（undefined でない）", () => {
    const detail = getMessageDetail("UNKNOWN_KEY_99");
    expect(detail).not.toBeUndefined();
    expect(detail.problem).toBeTruthy();
    expect(detail.impact).toBeTruthy();
    expect(detail.hint).toBeTruthy();
  });

  it("空文字の messageKey に対しても fallback オブジェクトを返す", () => {
    const detail = getMessageDetail("");
    expect(detail).not.toBeUndefined();
    expect(detail.problem).toBeTruthy();
  });

  // === 型チェック ===
  it("返り値が MessageDetail インターフェースを満たす", () => {
    const detail: MessageDetail = getMessageDetail("PATH_EMPTY_01");
    expect(typeof detail.problem).toBe("string");
    expect(typeof detail.impact).toBe("string");
    expect(typeof detail.hint).toBe("string");
  });

  it("全 messageKey のエントリが problem/impact/hint を持つ", () => {
    const allKeys = [
      "PATH_EMPTY_01",
      "PATH_STRAY_01",
      "PATH_THIN_LINE_01",
      "PATH_OVERFLOW_01",
      "TEXT_LIVE_01",
      "LAYER_HIDDEN_01",
      "LAYER_HIDDEN_OBJ_01",
      "IMG_RESOLUTION_LOW_01",
      "IMG_RESOLUTION_WARN_01",
      "IMG_RESOLUTION_LARGE_PRINT_01",
      "IMG_LINK_BROKEN_01",
      "IMG_COLOR_SPACE_01",
      "IMG_COLOR_SPACE_MANUAL_01",
      "IMG_RASTER_EFFECT_01",
      "IMG_RESOLUTION_UNKNOWN_01",
      "COLOR_DOC_MODE_01",
      "COLOR_INK_TOTAL_01",
      "COLOR_INK_DECIMAL_01",
      "COLOR_OVERPRINT_01",
      "COLOR_OVERPRINT_WHITE_01",
      "COLOR_UNUSED_SWATCH_01",
      "COLOR_SPOT_01",
      "BLEED_COVERAGE_01",
      "BLEED_SAFE_ZONE_01",
    ];
    for (const key of allKeys) {
      const detail = getMessageDetail(key);
      expect(detail.problem, `${key} に problem が必要`).toBeTruthy();
      expect(detail.impact, `${key} に impact が必要`).toBeTruthy();
      expect(detail.hint, `${key} に hint が必要`).toBeTruthy();
    }
  });

  it("hint は Illustrator UI の固定メニューパスではなく改善方針として表現する", () => {
    const allKeys = [
      "PATH_EMPTY_01",
      "PATH_STRAY_01",
      "PATH_THIN_LINE_01",
      "PATH_OVERFLOW_01",
      "TEXT_LIVE_01",
      "LAYER_HIDDEN_01",
      "LAYER_HIDDEN_OBJ_01",
      "IMG_RESOLUTION_LOW_01",
      "IMG_RESOLUTION_WARN_01",
      "IMG_RESOLUTION_LARGE_PRINT_01",
      "IMG_LINK_BROKEN_01",
      "IMG_COLOR_SPACE_01",
      "IMG_COLOR_SPACE_MANUAL_01",
      "IMG_RASTER_EFFECT_01",
      "IMG_RESOLUTION_UNKNOWN_01",
      "COLOR_DOC_MODE_01",
      "COLOR_INK_TOTAL_01",
      "COLOR_INK_DECIMAL_01",
      "COLOR_OVERPRINT_01",
      "COLOR_OVERPRINT_WHITE_01",
      "COLOR_UNUSED_SWATCH_01",
      "COLOR_SPOT_01",
      "BLEED_COVERAGE_01",
      "BLEED_SAFE_ZONE_01",
    ];
    for (const key of allKeys) {
      const detail = getMessageDetail(key);
      expect(detail.hint, `${key} の hint に固定メニューパスを含めない`).not.toMatch(/[［\[][^\]］]+>[^\]］]+[］\]]/);
    }
  });
});

describe("getMessageDetail — 追加キー", () => {
  for (const key of ["COLOR_REGISTRATION_01"]) {
    it(key + " のエントリを返す（フォールバックではない）", () => {
      const detail = getMessageDetail(key);
      expect(detail.problem).not.toBe("問題が検出されました");
      expect(detail.impact).toBeTruthy();
      expect(detail.hint).toBeTruthy();
    });
  }

  it("COLOR_UNUSED_SWATCH_01 のヒントはスウォッチパネルの「未使用項目を選択」を案内する", () => {
    expect(getMessageDetail("COLOR_UNUSED_SWATCH_01").hint).toContain("未使用項目を選択");
  });
});

describe("RGB 入稿プロファイルのメッセージ", () => {
  const fallback = getMessageDetail("__UNKNOWN_KEY__");
  for (const key of ["COLOR_DOC_MODE_RGB_01", "IMG_COLOR_SPACE_RGB_01", "IMG_COLOR_SPACE_CMYK_IN_RGB_01"]) {
    it(`${key} の専用エントリを返す`, () => {
      const detail = getMessageDetail(key);
      expect(detail.problem).not.toBe(fallback.problem);
      expect(detail.impact).toBeTruthy();
      expect(detail.hint).toBeTruthy();
    });
  }
});

describe("解像度メッセージは判定しきい値と一致する", () => {
  // checkImageResolution: ERROR < 300dpi, WARNING < 350dpi, 大判 ERROR < 200dpi
  it("IMG_RESOLUTION_LOW_01 は 300dpi 未満を示す", () => {
    expect(getMessageDetail("IMG_RESOLUTION_LOW_01").problem).toContain("300dpi未満");
  });

  it("IMG_RESOLUTION_WARN_01 は 300〜350dpi を示す", () => {
    expect(getMessageDetail("IMG_RESOLUTION_WARN_01").problem).toContain("300〜350dpi");
  });

  it("IMG_RESOLUTION_LARGE_PRINT_01 は 200dpi を基準として示す", () => {
    const detail = getMessageDetail("IMG_RESOLUTION_LARGE_PRINT_01");
    expect(detail.hint).toContain("200dpi");
    expect(detail.hint).not.toContain("150dpi");
  });
});

import { describe, it, expect } from "vitest";
import {
  checkSpotColors,
} from "../../src/jsx/hostscript/checks/checkSpotColors";
import type { SpotColorItem } from "../../src/jsx/hostscript/checks/checkSpotColors";

// SpotColor ヘルパー
function spotColor(name: string) {
  return { typename: "SpotColor", spot: { name } };
}

// RegistrationColor ヘルパー
function registrationColor() {
  return { typename: "RegistrationColor" };
}

// CMYKColor ヘルパー
function cmyk(c: number, m: number, y: number, k: number) {
  return { typename: "CMYKColor", cyan: c, magenta: m, yellow: y, black: k };
}

// NoColor ヘルパー
function noColor() {
  return { typename: "NoColor" };
}

function makeItem(
  name: string,
  fillColor: unknown,
  strokeColor: unknown = noColor()
): SpotColorItem {
  return { name, fillColor, strokeColor };
}

describe("checkSpotColors", () => {
  it("Test 7: fillColor が SpotColor（RegistrationColor 以外）→ WARNING / COLOR_SPOT_01", () => {
    const items: SpotColorItem[] = [
      makeItem("pantone-object", spotColor("Pantone 485")),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("COLOR_SPOT_01");
    expect(results[0].objectName).toBe("pantone-object");
    expect(results[0].targetRef).toMatchObject({
      kind: "pathItem",
      messageKey: "COLOR_SPOT_01",
      objectName: "pantone-object",
      collectionIndex: 0,
    });
  });

  it("Test 8: fillColor が RegistrationColor → 除外（WARNING なし）", () => {
    const items: SpotColorItem[] = [
      makeItem("trim-mark", registrationColor()),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 9: strokeColor がスポットカラー → WARNING 対象", () => {
    const items: SpotColorItem[] = [
      makeItem("stroke-spot", cmyk(0, 0, 0, 100), spotColor("Pantone 485")),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("COLOR_SPOT_01");
  });

  it("Test 10: fillColor が CMYKColor → 検出なし", () => {
    const items: SpotColorItem[] = [
      makeItem("cmyk-object", cmyk(100, 0, 0, 0)),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 11: スポットカラーが複数オブジェクトで使用 → 各オブジェクトの WARNING（重複あり）", () => {
    const items: SpotColorItem[] = [
      makeItem("obj1", spotColor("Pantone 485")),
      makeItem("obj2", spotColor("Pantone 485")),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(2);
    expect(results[0].objectName).toBe("obj1");
    expect(results[1].objectName).toBe("obj2");
  });

  it("空配列 → 空配列を返す", () => {
    const results = checkSpotColors([]);
    expect(results).toHaveLength(0);
  });

  // レジストレーション系カラーの除外テスト
  it("Test 12: strokeColor が RegistrationColor → 除外（WARNING なし）", () => {
    const items: SpotColorItem[] = [
      makeItem("trim-stroke", noColor(), registrationColor()),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 13: fillColor が CMYK 100/100/100/100 → 除外（WARNING なし）登録色として扱う", () => {
    // CMYK 100/100/100/100 は Illustrator の登録色と同等として除外する
    const items: SpotColorItem[] = [
      makeItem("trim-cmyk", cmyk(100, 100, 100, 100)),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 14: strokeColor が CMYK 100/100/100/100 → 除外（WARNING なし）", () => {
    const items: SpotColorItem[] = [
      makeItem("trim-cmyk-stroke", noColor(), cmyk(100, 100, 100, 100)),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 15: fillColor が SpotColor「Registration」→ 除外（WARNING なし）", () => {
    // Illustrator で Registration スウォッチを SpotColor として持つ場合
    const items: SpotColorItem[] = [
      makeItem("trim-spot-reg", spotColor("Registration")),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 16: fillColor が SpotColor「[Registration]」→ 除外（WARNING なし）", () => {
    const items: SpotColorItem[] = [
      makeItem("trim-spot-reg2", spotColor("[Registration]")),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 17: strokeColor が SpotColor「[レジストレーション]」（日本語ロケール）→ 除外（WARNING なし）", () => {
    // 日本語 Illustrator で spot.name が日本語で返る場合の対応
    const items: SpotColorItem[] = [
      makeItem("trim-jpn", noColor(), spotColor("[レジストレーション]")),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(0);
  });

  it("Test 18: spot プロパティが null/undefined の SpotColor → WARNING（Registration か判断不能）", () => {
    // spot が null で名前を確認できない SpotColor は安全のため WARNING を出す
    const items: SpotColorItem[] = [
      makeItem("unknown-spot", { typename: "SpotColor", spot: null }),
    ];
    const results = checkSpotColors(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
  });
});

import { describe, it, expect } from "vitest";
import { checkInkTotal } from "../../src/jsx/hostscript/checks/checkInkTotal";
import type { InkCheckItem } from "../../src/jsx/hostscript/checks/checkInkTotal";

function makeCmyk(c: number, m: number, y: number, k: number) {
  return { typename: "CMYKColor" as const, cyan: c, magenta: m, yellow: y, black: k };
}

function makeItem(
  name: string,
  fillColor: unknown,
  strokeColor: unknown = { typename: "NoColor" }
): InkCheckItem {
  return { name, fillColor, strokeColor };
}

describe("checkInkTotal — COLOR-02（合計 350% 超 WARNING）", () => {
  it("COLOR-02: C=100 M=100 Y=100 K=100 → 合計 400 → WARNING / COLOR_INK_TOTAL_01", () => {
    const items = [{
      ...makeItem("obj1", makeCmyk(100, 100, 100, 100)),
      typename: "PathItem",
      layer: { name: "Artwork" },
      geometricBounds: [0, 100, 100, 0] as [number, number, number, number],
    }];
    const results = checkInkTotal(items);
    const warnings = results.filter((r) => r.messageKey === "COLOR_INK_TOTAL_01");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("WARNING");
    expect(warnings[0].objectName).toBe("obj1");
    expect(warnings[0].targetRef).toMatchObject({
      kind: "pathItem",
      messageKey: "COLOR_INK_TOTAL_01",
      objectName: "obj1",
      layerName: "Artwork",
      collectionIndex: 0,
    });
  });

  it("COLOR-02: C=90 M=90 Y=90 K=80 → 合計 350 → WARNING なし（境界値 = 350 は OK）", () => {
    const items = [makeItem("obj2", makeCmyk(90, 90, 90, 80))];
    const results = checkInkTotal(items);
    const warnings = results.filter((r) => r.messageKey === "COLOR_INK_TOTAL_01");
    expect(warnings).toHaveLength(0);
  });

  it("COLOR-02: C=90 M=90 Y=90 K=81 → 合計 351 → WARNING", () => {
    const items = [makeItem("obj3", makeCmyk(90, 90, 90, 81))];
    const results = checkInkTotal(items);
    const warnings = results.filter((r) => r.messageKey === "COLOR_INK_TOTAL_01");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("WARNING");
  });

  it("COLOR-02: C=0 M=0 Y=0 K=0 → WARNING なし", () => {
    const items = [makeItem("obj4", makeCmyk(0, 0, 0, 0))];
    const results = checkInkTotal(items);
    const warnings = results.filter((r) => r.messageKey === "COLOR_INK_TOTAL_01");
    expect(warnings).toHaveLength(0);
  });

  it("COLOR-02: fillColor が CMYKColor でない（SpotColor など）→ スキップ（クラッシュしない）", () => {
    const spotColor = { typename: "SpotColor", spot: {}, tint: 100 };
    const items = [makeItem("obj5", spotColor)];
    expect(() => checkInkTotal(items)).not.toThrow();
    const results = checkInkTotal(items);
    expect(results).toHaveLength(0);
  });
});

describe("checkInkTotal — COLOR-03（小数値 INFO）", () => {
  it("COLOR-03: C=50.5 M=0 Y=0 K=0 → INFO / COLOR_INK_DECIMAL_01", () => {
    const items = [{
      ...makeItem("obj6", makeCmyk(50.5, 0, 0, 0)),
      typename: "PathItem",
      geometricBounds: [0, 100, 100, 0] as [number, number, number, number],
    }];
    const results = checkInkTotal(items);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe("INFO");
    expect(infos[0].objectName).toBe("obj6");
    expect(infos[0].targetRef).toMatchObject({
      kind: "pathItem",
      messageKey: "COLOR_INK_DECIMAL_01",
      objectName: "obj6",
      collectionIndex: 0,
    });
  });

  it("COLOR-03: C=50 M=0 Y=0 K=0 → INFO なし（整数値）", () => {
    const items = [makeItem("obj7", makeCmyk(50, 0, 0, 0))];
    const results = checkInkTotal(items);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(0);
  });

  it("COLOR-03: strokeColor が CMYKColor で小数値あり → INFO 対象", () => {
    const items = [
      makeItem("obj8", { typename: "NoColor" }, makeCmyk(0, 33.3, 0, 0)),
    ];
    const results = checkInkTotal(items);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe("INFO");
    expect(infos[0].objectName).toBe("obj8");
  });
});

describe("checkInkTotal — クリッピングパスの除外", () => {
  it("clipping: true の PathItem は CMYK 小数点があってもスキップされる", () => {
    const item: InkCheckItem = {
      name: "clipping-mask",
      fillColor: makeCmyk(33.3, 0, 0, 0), // 小数点あり
      strokeColor: { typename: "NoColor" },
      clipping: true,
    };
    const results = checkInkTotal([item]);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(0);
  });

  it("clipping: true の PathItem は CMYK 合計超過があってもスキップされる", () => {
    const item: InkCheckItem = {
      name: "clipping-mask-heavy",
      fillColor: makeCmyk(100, 100, 100, 100), // 400% 超過
      strokeColor: { typename: "NoColor" },
      clipping: true,
    };
    const results = checkInkTotal([item]);
    const warnings = results.filter((r) => r.messageKey === "COLOR_INK_TOTAL_01");
    expect(warnings).toHaveLength(0);
  });

  it("clipping: false の PathItem は通常通りチェックされる", () => {
    const item: InkCheckItem = {
      name: "normal-path",
      fillColor: makeCmyk(50.5, 0, 0, 0), // 小数点あり
      strokeColor: { typename: "NoColor" },
      clipping: false,
    };
    const results = checkInkTotal([item]);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(1);
  });

  it("clipping プロパティなし（既存動作）→ 通常通りチェックされる", () => {
    const item: InkCheckItem = {
      name: "legacy-path",
      fillColor: makeCmyk(50.5, 0, 0, 0),
      strokeColor: { typename: "NoColor" },
      // clipping プロパティなし
    };
    const results = checkInkTotal([item]);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(1);
  });
});

describe("checkInkTotal — 画像アイテムの除外", () => {
  it("typename='PlacedItem' の場合、CMYK 小数点があってもスキップされる", () => {
    const item: InkCheckItem = {
      typename: "PlacedItem",
      name: "linked-image.tif",
      fillColor: makeCmyk(33.3, 0, 0, 0),
      strokeColor: { typename: "NoColor" },
    };
    const results = checkInkTotal([item]);
    expect(results).toHaveLength(0);
  });

  it("typename='PlacedItem' の場合、CMYK 合計超過があってもスキップされる", () => {
    const item: InkCheckItem = {
      typename: "PlacedItem",
      name: "linked-image.tif",
      fillColor: makeCmyk(100, 100, 100, 100),
      strokeColor: { typename: "NoColor" },
    };
    const results = checkInkTotal([item]);
    expect(results).toHaveLength(0);
  });

  it("typename='RasterItem' の場合、CMYK 小数点があってもスキップされる", () => {
    const item: InkCheckItem = {
      typename: "RasterItem",
      name: "embedded-image.psd",
      fillColor: makeCmyk(0, 66.6, 0, 0),
      strokeColor: { typename: "NoColor" },
    };
    const results = checkInkTotal([item]);
    expect(results).toHaveLength(0);
  });

  it("typename='PathItem' の場合は通常通りチェックされる", () => {
    const item: InkCheckItem = {
      typename: "PathItem",
      name: "normal-path",
      fillColor: makeCmyk(50.5, 0, 0, 0),
      strokeColor: { typename: "NoColor" },
    };
    const results = checkInkTotal([item]);
    const infos = results.filter((r) => r.messageKey === "COLOR_INK_DECIMAL_01");
    expect(infos).toHaveLength(1);
  });
});

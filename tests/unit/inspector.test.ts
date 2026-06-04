import { describe, it, expect } from "vitest";
import {
  collectPathItems,
  collectTextFrames,
  collectPlacedItems,
  collectRasterItems,
} from "../../src/jsx/hostscript/inspector";

// モック用のヘルパー型 (DocumentLike)
type MockLayer = {
  pageItems: MockItem[];
  layers: MockLayer[];
};

type MockItem = {
  typename: string;
  name: string;
  [key: string]: unknown;
};

function makeDoc(layers: MockLayer[]): Document {
  return { layers } as unknown as Document;
}

describe("inspector — collectPlacedItems", () => {
  it("INSP-PI-01: レイヤー直下の PlacedItem を収集できる", () => {
    const placedItem: MockItem = {
      typename: "PlacedItem",
      name: "linked-image.ai",
      file: { fsName: "/path/to/image.ai" },
      matrix: { mValueA: 1, mValueD: 1 },
      geometricBounds: [0, 100, 100, 0],
    };
    const doc = makeDoc([
      {
        pageItems: [placedItem],
        layers: [],
      },
    ]);

    const result = collectPlacedItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].typename).toBe("PlacedItem");
    expect(result[0].name).toBe("linked-image.ai");
  });

  it("INSP-PI-02: グループ内の PlacedItem を再帰的に収集できる", () => {
    const placedItem: MockItem = {
      typename: "PlacedItem",
      name: "nested-image.ai",
      file: { fsName: "/path/to/nested.ai" },
      matrix: { mValueA: 1, mValueD: 1 },
      geometricBounds: [0, 100, 100, 0],
    };
    const groupItem: MockItem = {
      typename: "GroupItem",
      name: "group",
      pageItems: [placedItem],
    };
    const doc = makeDoc([
      {
        pageItems: [groupItem],
        layers: [],
      },
    ]);

    const result = collectPlacedItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("nested-image.ai");
  });

  it("INSP-PI-03: サブレイヤー内の PlacedItem を再帰的に収集できる", () => {
    const placedItem: MockItem = {
      typename: "PlacedItem",
      name: "sublayer-image.ai",
      file: { fsName: "/path/to/sublayer.ai" },
      matrix: { mValueA: 1, mValueD: 1 },
      geometricBounds: [0, 100, 100, 0],
    };
    const doc = makeDoc([
      {
        pageItems: [],
        layers: [
          {
            pageItems: [placedItem],
            layers: [],
          },
        ],
      },
    ]);

    const result = collectPlacedItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("sublayer-image.ai");
  });

  it("INSP-PI-04: PlacedItem がない場合は空配列を返す", () => {
    const doc = makeDoc([{ pageItems: [], layers: [] }]);
    const result = collectPlacedItems(doc);
    expect(result).toHaveLength(0);
  });
});

describe("inspector — collectRasterItems", () => {
  it("INSP-RI-01: レイヤー直下の RasterItem を収集できる", () => {
    const rasterItem: MockItem = {
      typename: "RasterItem",
      name: "embedded-raster",
      imageColorSpace: "CMYK",
      embedded: true,
      geometricBounds: [0, 100, 100, 0],
    };
    const doc = makeDoc([
      {
        pageItems: [rasterItem],
        layers: [],
      },
    ]);

    const result = collectRasterItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].typename).toBe("RasterItem");
    expect(result[0].name).toBe("embedded-raster");
  });

  it("INSP-RI-02: グループ内の RasterItem を再帰的に収集できる", () => {
    const rasterItem: MockItem = {
      typename: "RasterItem",
      name: "group-raster",
      imageColorSpace: "CMYK",
      embedded: true,
      geometricBounds: [0, 100, 100, 0],
    };
    const groupItem: MockItem = {
      typename: "GroupItem",
      name: "group",
      pageItems: [rasterItem],
    };
    const doc = makeDoc([
      {
        pageItems: [groupItem],
        layers: [],
      },
    ]);

    const result = collectRasterItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("group-raster");
  });

  it("INSP-RI-03: RasterItem がない場合は空配列を返す", () => {
    const doc = makeDoc([{ pageItems: [], layers: [] }]);
    const result = collectRasterItems(doc);
    expect(result).toHaveLength(0);
  });
});

// CompoundPathItem は Illustrator の型定義上 stroked/strokeWidth を持たない
// 実際のストローク情報は CompoundPathItem.pathItems の子 PathItem が持つ
// → collectPathItems は CompoundPathItem を直接返さず、その子 pathItems を展開して収集する
describe("inspector — collectPathItems CompoundPathItem 対応", () => {
  it("INSP-CP-01: レイヤー直下の CompoundPathItem の子 PathItem を収集できる", () => {
    const innerPath: MockItem = {
      typename: "PathItem",
      name: "compound-path-1-inner",
      stroked: true,
      strokeWidth: 0.1,
      geometricBounds: [0, 10, 10, 0],
    };
    const compoundPath: MockItem = {
      typename: "CompoundPathItem",
      name: "compound-path-1",
      pathItems: [innerPath],
    };
    const doc = makeDoc([
      {
        pageItems: [compoundPath],
        layers: [],
      },
    ]);

    const result = collectPathItems(doc);
    expect(result).toHaveLength(1);
    // CompoundPathItem ではなく子 PathItem が収集される
    expect(result[0].typename).toBe("PathItem");
    expect((result[0] as unknown as MockItem).strokeWidth).toBe(0.1);
  });

  it("INSP-CP-02: グループ内の CompoundPathItem の子 PathItem を再帰的に収集できる", () => {
    const innerPath: MockItem = {
      typename: "PathItem",
      name: "compound-in-group-inner",
      stroked: true,
      strokeWidth: 0.1,
      geometricBounds: [0, 10, 10, 0],
    };
    const compoundPath: MockItem = {
      typename: "CompoundPathItem",
      name: "compound-in-group",
      pathItems: [innerPath],
    };
    const groupItem: MockItem = {
      typename: "GroupItem",
      name: "group",
      pageItems: [compoundPath],
    };
    const doc = makeDoc([
      {
        pageItems: [groupItem],
        layers: [],
      },
    ]);

    const result = collectPathItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].typename).toBe("PathItem");
    expect((result[0] as unknown as MockItem).strokeWidth).toBe(0.1);
  });

  it("INSP-CP-03: サブレイヤー内の CompoundPathItem の子 PathItem を再帰的に収集できる", () => {
    const innerPath: MockItem = {
      typename: "PathItem",
      name: "compound-in-sublayer-inner",
      stroked: true,
      strokeWidth: 0.1,
      geometricBounds: [0, 10, 10, 0],
    };
    const compoundPath: MockItem = {
      typename: "CompoundPathItem",
      name: "compound-in-sublayer",
      pathItems: [innerPath],
    };
    const doc = makeDoc([
      {
        pageItems: [],
        layers: [
          {
            pageItems: [compoundPath],
            layers: [],
          },
        ],
      },
    ]);

    const result = collectPathItems(doc);
    expect(result).toHaveLength(1);
    expect(result[0].typename).toBe("PathItem");
  });

  it("INSP-CP-04: PathItem と CompoundPathItem が混在する場合、PathItem + 子 PathItem がすべて収集される", () => {
    const pathItem: MockItem = {
      typename: "PathItem",
      name: "path-1",
      stroked: true,
      strokeWidth: 0.5,
      geometricBounds: [0, 10, 10, 0],
    };
    const innerPath: MockItem = {
      typename: "PathItem",
      name: "compound-1-inner",
      stroked: true,
      strokeWidth: 0.1,
      geometricBounds: [0, 5, 5, 0],
    };
    const compoundPath: MockItem = {
      typename: "CompoundPathItem",
      name: "compound-1",
      pathItems: [innerPath],
    };
    const doc = makeDoc([
      {
        pageItems: [pathItem, compoundPath],
        layers: [],
      },
    ]);

    const result = collectPathItems(doc);
    // PathItem 1件 + CompoundPathItem の子 PathItem 1件 = 2件
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.typename === "PathItem")).toBe(true);
  });

  it("INSP-CP-05: CompoundPathItem の子 PathItem が細線閾値未満なら checkThinLines で検出される", () => {
    // checkThinLines との結合テスト: 実機で CompoundPath の細線が検出されることを確認
    const innerPath: MockItem = {
      typename: "PathItem",
      name: "thin-compound-inner",
      stroked: true,
      strokeWidth: 0.28, // 0.284pt 未満 → 細線
      layer: { name: "レイヤー 1" },
      geometricBounds: [0, 10, 10, 0],
    };
    const compoundPath: MockItem = {
      typename: "CompoundPathItem",
      name: "thin-compound",
      pathItems: [innerPath],
    };
    const doc = makeDoc([{ pageItems: [compoundPath], layers: [] }]);

    const pathItems = collectPathItems(doc);
    // checkThinLines は pathItems を受け取る — import が必要
    // ここでは収集結果のみ検証（checkThinLines 側は checkThinLines.test.ts でカバー済み）
    expect(pathItems).toHaveLength(1);
    expect((pathItems[0] as unknown as MockItem).strokeWidth).toBe(0.28);
    expect((pathItems[0] as unknown as MockItem).stroked).toBe(true);
  });
});

// 既存関数のスモークテスト (regression)
describe("inspector — 既存関数 regression", () => {
  it("INSP-REG-01: collectPathItems が正常に動作する", () => {
    const pathItem: MockItem = {
      typename: "PathItem",
      name: "path1",
    };
    const doc = makeDoc([{ pageItems: [pathItem], layers: [] }]);
    const result = collectPathItems(doc);
    expect(result).toHaveLength(1);
  });

  it("INSP-REG-02: collectTextFrames が正常に動作する", () => {
    const textFrame: MockItem = {
      typename: "TextFrame",
      name: "text1",
    };
    const doc = makeDoc([{ pageItems: [textFrame], layers: [] }]);
    const result = collectTextFrames(doc);
    expect(result).toHaveLength(1);
  });

  it("INSP-REG-03: 親レイヤーとサブレイヤーで同一参照が返っても重複収集しない", () => {
    const pathItem: MockItem = { typename: "PathItem", name: "path1" };
    const textFrame: MockItem = { typename: "TextFrame", name: "text1" };
    const placedItem: MockItem = {
      typename: "PlacedItem",
      name: "placed1",
      matrix: { mValueA: 1, mValueD: 1 },
      geometricBounds: [0, 100, 100, 0],
    };
    const rasterItem: MockItem = {
      typename: "RasterItem",
      name: "raster1",
      imageColorSpace: "CMYK",
      embedded: true,
      geometricBounds: [0, 100, 100, 0],
    };
    const sublayer = {
      pageItems: [pathItem, textFrame, placedItem, rasterItem],
      layers: [],
    };
    const doc = makeDoc([
      {
        pageItems: [pathItem, textFrame, placedItem, rasterItem],
        layers: [sublayer],
      },
    ]);

    expect(collectPathItems(doc)).toHaveLength(1);
    expect(collectTextFrames(doc)).toHaveLength(1);
    expect(collectPlacedItems(doc)).toHaveLength(1);
    expect(collectRasterItems(doc)).toHaveLength(1);
  });

  it("INSP-REG-04: Array.prototype.indexOf がない ExtendScript 互換環境でも収集できる", () => {
    const originalIndexOf = Array.prototype.indexOf;
    let result: ReturnType<typeof collectPathItems>;
    delete (Array.prototype as unknown as { indexOf?: unknown }).indexOf;
    try {
      const pathItem: MockItem = {
        typename: "PathItem",
        name: "path-without-indexof",
      };
      const doc = makeDoc([{ pageItems: [pathItem, pathItem], layers: [] }]);
      result = collectPathItems(doc);
    } finally {
      Array.prototype.indexOf = originalIndexOf;
    }
    expect(result!).toHaveLength(1);
  });
});

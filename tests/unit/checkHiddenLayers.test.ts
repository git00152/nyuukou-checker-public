import { describe, it, expect } from "vitest";
import { checkHiddenLayers } from "../../src/jsx/hostscript/checks/checkHiddenLayers";

describe("checkHiddenLayers", () => {
  it("LAYER-01: visible === false のレイヤーを WARNING / LAYER_HIDDEN_01 として検出する", () => {
    const mockDoc = {
      layers: [
        {
          name: "非表示レイヤー",
          visible: false,
          layers: [],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenLayers(mockDoc);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("LAYER_HIDDEN_01");
    expect(results[0].layerName).toBe("非表示レイヤー");
  });

  it("LAYER-01: visible === true のレイヤーは検出しない", () => {
    const mockDoc = {
      layers: [
        {
          name: "表示レイヤー",
          visible: true,
          layers: [],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenLayers(mockDoc);
    expect(results).toHaveLength(0);
  });

  it("LAYER-01: サブレイヤーも再帰的に検査する", () => {
    const mockDoc = {
      layers: [
        {
          name: "親レイヤー",
          visible: true,
          layers: [
            {
              name: "非表示サブレイヤー",
              visible: false,
              layers: [],
            },
            {
              name: "表示サブレイヤー",
              visible: true,
              layers: [],
            },
          ],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenLayers(mockDoc);
    expect(results).toHaveLength(1);
    expect(results[0].layerName).toBe("非表示サブレイヤー");
  });

  it("LAYER-01: 親と子の両方が非表示の場合は両方を検出する", () => {
    const mockDoc = {
      layers: [
        {
          name: "非表示親",
          visible: false,
          layers: [
            {
              name: "非表示子",
              visible: false,
              layers: [],
            },
          ],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenLayers(mockDoc);
    expect(results).toHaveLength(2);
  });

  it("LAYER-01: レイヤーが空の場合は空配列を返す", () => {
    const mockDoc = {
      layers: [],
    } as unknown as Document;

    const results = checkHiddenLayers(mockDoc);
    expect(results).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { checkHiddenObjects } from "../../src/jsx/hostscript/checks/checkHiddenObjects";

describe("checkHiddenObjects", () => {
  it("LAYER-02: hidden === true のオブジェクトを WARNING / LAYER_HIDDEN_OBJ_01 として検出する", () => {
    const mockDoc = {
      layers: [
        {
          name: "Layer 1",
          pageItems: [
            {
              hidden: true,
              name: "hiddenObj",
              geometricBounds: [0, 100, 100, 0],
            },
          ],
          layers: [],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenObjects(mockDoc);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("LAYER_HIDDEN_OBJ_01");
    expect(results[0].objectName).toBe("hiddenObj");
    expect(results[0].layerName).toBe("Layer 1");
  });

  it("LAYER-02: hidden === false のオブジェクトは検出しない", () => {
    const mockDoc = {
      layers: [
        {
          name: "Layer 1",
          pageItems: [
            {
              hidden: false,
              name: "visibleObj",
              geometricBounds: [0, 100, 100, 0],
            },
          ],
          layers: [],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenObjects(mockDoc);
    expect(results).toHaveLength(0);
  });

  it("LAYER-02: 複数レイヤーのオブジェクトを横断的に検索する", () => {
    const mockDoc = {
      layers: [
        {
          name: "Layer 1",
          pageItems: [
            {
              hidden: true,
              name: "hidden1",
              geometricBounds: [0, 100, 100, 0],
            },
          ],
          layers: [],
        },
        {
          name: "Layer 2",
          pageItems: [
            {
              hidden: false,
              name: "visible1",
              geometricBounds: [0, 100, 100, 0],
            },
            {
              hidden: true,
              name: "hidden2",
              geometricBounds: [0, 50, 50, 0],
            },
          ],
          layers: [],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenObjects(mockDoc);
    expect(results).toHaveLength(2);
    expect(results[0].objectName).toBe("hidden1");
    expect(results[1].objectName).toBe("hidden2");
  });

  it("LAYER-02: サブレイヤーのオブジェクトも検索する", () => {
    const mockDoc = {
      layers: [
        {
          name: "親レイヤー",
          pageItems: [],
          layers: [
            {
              name: "サブレイヤー",
              pageItems: [
                {
                  hidden: true,
                  name: "hiddenInSub",
                  geometricBounds: [0, 100, 100, 0],
                },
              ],
              layers: [],
            },
          ],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenObjects(mockDoc);
    expect(results).toHaveLength(1);
    expect(results[0].objectName).toBe("hiddenInSub");
    expect(results[0].layerName).toBe("サブレイヤー");
  });

  it("LAYER-02: ドキュメントにレイヤーがない場合は空配列を返す", () => {
    const mockDoc = {
      layers: [],
    } as unknown as Document;

    const results = checkHiddenObjects(mockDoc);
    expect(results).toHaveLength(0);
  });

  it("LAYER-02: ソースファイル内の message 文字列リテラルが日本語 UTF-8 バイトを含まないこと — CEP 文字化け防止", () => {
    // CEP ブリッジは UTF-8 日本語リテラルを Shift-JIS として解釈して文字化けさせる。
    // message は Unicode エスケープ形式（全 ASCII バイト）でなければならない。
    const srcPath = path.resolve(
      __dirname,
      "../../src/jsx/hostscript/checks/checkHiddenObjects.ts"
    );
    const rawBytes = fs.readFileSync(srcPath);
    const marker = Buffer.from('message: "');
    const messageByteStart = rawBytes.indexOf(marker);
    expect(messageByteStart).toBeGreaterThan(-1);
    let hasHighByte = false;
    for (let i = messageByteStart + marker.length; i < rawBytes.length; i++) {
      const byte = rawBytes[i];
      if (byte === 0x22) break;
      if (byte > 0x7f) { hasHighByte = true; break; }
    }
    expect(hasHighByte).toBe(false);
  });

  it("LAYER-02: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 0,
      1: 100,
      2: 100,
      3: 0,
      length: 4,
    });
    const mockDoc = {
      layers: [
        {
          name: "Layer 1",
          pageItems: [
            {
              hidden: true,
              name: "hiddenObj",
              geometricBounds: nativeLike,
            },
          ],
          layers: [],
        },
      ],
    } as unknown as Document;

    const results = checkHiddenObjects(mockDoc);

    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([0, 100, 100, 0]);
  });
});

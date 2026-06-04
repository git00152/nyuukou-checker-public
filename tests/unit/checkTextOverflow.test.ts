import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { checkTextOverflow } from "../../src/jsx/hostscript/checks/checkTextOverflow";

describe("checkTextOverflow", () => {
  it("PATH-04: overflows === true のテキストフレームを ERROR / PATH_OVERFLOW_01 として検出する", () => {
    const mockTextFrames = [
      {
        overflows: true,
        name: "textbox1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
        contents: "溢れているテキスト",
      },
    ] as unknown as TextFrame[];

    const results = checkTextOverflow(mockTextFrames);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("PATH_OVERFLOW_01");
    expect(results[0].objectName).toBe("textbox1");
    expect(results[0].layerName).toBe("Layer 1");
    expect(results[0].targetRef).toMatchObject({
      kind: "textFrame",
      messageKey: "PATH_OVERFLOW_01",
      objectName: "textbox1",
      layerName: "Layer 1",
      collectionIndex: 0,
    });
  });

  it("PATH-04: overflows === false のテキストフレームは検出しない", () => {
    const mockTextFrames = [
      {
        overflows: false,
        name: "textbox2",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
        contents: "収まっているテキスト",
      },
    ] as unknown as TextFrame[];

    const results = checkTextOverflow(mockTextFrames);
    expect(results).toHaveLength(0);
  });

  it("PATH-04: overflows プロパティがなくても contents が表示行より長ければ検出する", () => {
    const mockTextFrames = [
      {
        name: "area-text",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
        contents: "表示される文字隠れた文字",
        lines: [
          { contents: "表示される文字" },
        ],
      },
    ] as unknown as TextFrame[];

    const results = checkTextOverflow(mockTextFrames);

    expect(results).toHaveLength(1);
    expect(results[0].messageKey).toBe("PATH_OVERFLOW_01");
    expect(results[0].targetRef).toMatchObject({ kind: "textFrame", objectName: "area-text" });
  });

  it("PATH-04: contents と表示行の長さが一致する場合は検出しない", () => {
    const mockTextFrames = [
      {
        name: "fit-text",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
        contents: "1行目\r2行目",
        lines: [
          { contents: "1行目" },
          { contents: "2行目" },
        ],
      },
    ] as unknown as TextFrame[];

    const results = checkTextOverflow(mockTextFrames);

    expect(results).toHaveLength(0);
  });

  it("PATH-04: 複数フレームのうちオーバーフローしているものだけ検出する", () => {
    const mockTextFrames = [
      {
        overflows: true,
        name: "overflow1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
        contents: "溢れ",
      },
      {
        overflows: false,
        name: "normal1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 0],
        contents: "正常",
      },
    ] as unknown as TextFrame[];

    const results = checkTextOverflow(mockTextFrames);
    expect(results).toHaveLength(1);
    expect(results[0].objectName).toBe("overflow1");
  });

  it("PATH-04: 空配列を渡すと空配列を返す", () => {
    const results = checkTextOverflow([] as unknown as TextFrame[]);
    expect(results).toHaveLength(0);
  });

  it("PATH-04: ソースファイル内の message 文字列リテラルが日本語 UTF-8 バイトを含まないこと — CEP 文字化け防止", () => {
    // CEP ブリッジは UTF-8 日本語リテラルを Shift-JIS として解釈して文字化けさせる。
    // message は Unicode エスケープ形式（全 ASCII バイト）でなければならない。
    const srcPath = path.resolve(
      __dirname,
      "../../src/jsx/hostscript/checks/checkTextOverflow.ts"
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

  it("PATH-04: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 0,
      1: 100,
      2: 100,
      3: 0,
      length: 4,
    });
    const mockTextFrames = [
      {
        overflows: true,
        name: "textbox",
        layer: { name: "Layer 1" },
        geometricBounds: nativeLike,
        contents: "溢れ",
      },
    ] as unknown as TextFrame[];

    const results = checkTextOverflow(mockTextFrames);

    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([0, 100, 100, 0]);
  });
});

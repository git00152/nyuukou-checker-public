import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { checkEmptyPaths } from "../../src/jsx/hostscript/checks/checkEmptyPaths";

describe("checkEmptyPaths", () => {
  it("PATH-01: 塗りなし・線なしのパスを WARNING / PATH_EMPTY_01 として検出する", () => {
    const mockPathItems = [
      {
        filled: false,
        stroked: false,
        name: "rect1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 10, 10, 0],
      },
    ] as unknown as PathItem[];

    const results = checkEmptyPaths(mockPathItems);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("PATH_EMPTY_01");
    expect(results[0].objectName).toBe("rect1");
    expect(results[0].layerName).toBe("Layer 1");
  });

  it("PATH-01: 塗りありのパスは検出しない", () => {
    const mockPathItems = [
      {
        filled: true,
        stroked: false,
        name: "rect2",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 10, 10, 0],
      },
    ] as unknown as PathItem[];

    const results = checkEmptyPaths(mockPathItems);
    expect(results).toHaveLength(0);
  });

  it("PATH-01: 線ありのパスは検出しない", () => {
    const mockPathItems = [
      {
        filled: false,
        stroked: true,
        name: "rect3",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 10, 10, 0],
      },
    ] as unknown as PathItem[];

    const results = checkEmptyPaths(mockPathItems);
    expect(results).toHaveLength(0);
  });

  it("PATH-01: クリッピングマスクのパスは塗りなし・線なしでも検出しない", () => {
    const mockPathItems = [
      {
        filled: false,
        stroked: false,
        clipping: true,
        name: "clipping-mask",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 10, 10, 0],
      },
    ] as unknown as PathItem[];

    const results = checkEmptyPaths(mockPathItems);
    expect(results).toHaveLength(0);
  });

  it("PATH-01: 複数のパスのうち塗りなし・線なしのみ検出する", () => {
    const mockPathItems = [
      {
        filled: false,
        stroked: false,
        name: "empty1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 10, 10, 0],
      },
      {
        filled: true,
        stroked: false,
        name: "filled1",
        layer: { name: "Layer 1" },
        geometricBounds: [20, 30, 30, 20],
      },
      {
        filled: false,
        stroked: false,
        name: "empty2",
        layer: { name: "Layer 2" },
        geometricBounds: [40, 50, 50, 40],
      },
    ] as unknown as PathItem[];

    const results = checkEmptyPaths(mockPathItems);
    expect(results).toHaveLength(2);
    expect(results[0].objectName).toBe("empty1");
    expect(results[1].objectName).toBe("empty2");
  });

  it("PATH-01: 空配列を渡すと空配列を返す", () => {
    const results = checkEmptyPaths([] as unknown as PathItem[]);
    expect(results).toHaveLength(0);
  });

  it("PATH-01: ソースファイル内の message 文字列リテラルが日本語 UTF-8 バイトを含まないこと — CEP 文字化け防止", () => {
    // CEP ブリッジは UTF-8 日本語リテラルを Shift-JIS として解釈して文字化けさせる。
    // ExtendScript ソースファイル内の message 文字列は全て Unicode エスケープ形式で書く必要がある。
    // このテストはソースファイルのバイト列を直接検査して、日本語 UTF-8 バイト (>0x7F) が
    // message: "..." の値部分に含まれていないことを検証する。
    const srcPath = path.resolve(
      __dirname,
      "../../src/jsx/hostscript/checks/checkEmptyPaths.ts"
    );
    const srcContent = fs.readFileSync(srcPath, "utf-8");
    // message: "..." の値を抽出
    const messageMatch = srcContent.match(/message:\s*"([^"]*)"/);
    expect(messageMatch).not.toBeNull();
    const messageValue = messageMatch![1];
    // UTF-8 文字列としてのコードポイントが 0x7F 超の文字が含まれていないこと
    // (ソース上で \uXXXX 形式で書かれていれば、読み込み後も日本語文字として展開されるが、
    //  ここではソースの raw バイト列で確認する)
    const rawBytes = fs.readFileSync(srcPath);
    const messageByteStart = rawBytes.indexOf(Buffer.from('message: "'));
    expect(messageByteStart).toBeGreaterThan(-1);
    // message: " から次の " までの範囲で 0x80 以上のバイトがないことを確認
    let inValue = false;
    let hasHighByte = false;
    for (let i = messageByteStart + 'message: "'.length; i < rawBytes.length; i++) {
      const byte = rawBytes[i];
      if (byte === 0x22) break; // 閉じ "
      if (byte > 0x7f) { hasHighByte = true; break; }
    }
    expect(hasHighByte).toBe(false);
  });

  it("PATH-01: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    // Illustratorのネイティブ配列は instanceof Array が false になる場合がある。
    // json2.js でシリアライズすると {"0":x,...} オブジェクト形式になり、
    // React 側で join() 等が使えなくなる。
    // チェッカーは [gb[0], gb[1], gb[2], gb[3]] でプレーン配列に変換して返す必要がある。
    const nativeLike = Object.assign(Object.create(null), {
      0: 10,
      1: 200,
      2: 150,
      3: 50,
      length: 4,
    });
    const mockPathItems = [
      {
        filled: false,
        stroked: false,
        name: "emptyPath",
        layer: { name: "Layer 1" },
        geometricBounds: nativeLike,
      },
    ] as unknown as PathItem[];

    const results = checkEmptyPaths(mockPathItems);

    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([10, 200, 150, 50]);
  });
});

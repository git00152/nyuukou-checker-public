import { describe, it, expect } from "vitest";
import { checkLiveText } from "../../src/jsx/hostscript/checks/checkLiveText";

describe("checkLiveText", () => {
  it("TEXT-01: テキストフレームが 1 件以上ある場合、全フレームを ERROR / TEXT_LIVE_01 として返す", () => {
    const mockTextFrames = [
      {
        contents: "見出しテキスト",
        name: "title",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 200, 80],
      },
    ] as unknown as TextFrame[];

    const results = checkLiveText(mockTextFrames);

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("TEXT_LIVE_01");
    expect(results[0].objectName).toBe("title");
    expect(results[0].layerName).toBe("Layer 1");
    expect(results[0].targetRef).toMatchObject({
      kind: "textFrame",
      messageKey: "TEXT_LIVE_01",
      objectName: "title",
      layerName: "Layer 1",
      collectionIndex: 0,
    });
  });

  it("TEXT-01: contents が 20 文字以下の場合はそのままメッセージに含める", () => {
    const shortText = "短いテキスト";
    const mockTextFrames = [
      {
        contents: shortText,
        name: "short",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 80],
      },
    ] as unknown as TextFrame[];

    const results = checkLiveText(mockTextFrames);

    expect(results[0].message).toContain(shortText);
    expect(results[0].message).not.toContain("...");
  });

  it("TEXT-01: contents が 20 文字超の場合はメッセージを '...' で省略する", () => {
    const longText = "これは非常に長いテキストフレームの内容です";
    expect(longText.length).toBeGreaterThan(20);

    const mockTextFrames = [
      {
        contents: longText,
        name: "long",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 80],
      },
    ] as unknown as TextFrame[];

    const results = checkLiveText(mockTextFrames);

    expect(results[0].message).toContain("...");
    expect(results[0].message).toContain(longText.substring(0, 20));
  });

  it("TEXT-01: テキストフレームが空の場合は空配列を返す", () => {
    const results = checkLiveText([] as unknown as TextFrame[]);
    expect(results).toHaveLength(0);
  });

  it("TEXT-01: 複数テキストフレームの場合は全て ERROR として返す", () => {
    const mockTextFrames = [
      {
        contents: "テキスト1",
        name: "text1",
        layer: { name: "Layer 1" },
        geometricBounds: [0, 100, 100, 80],
      },
      {
        contents: "テキスト2",
        name: "text2",
        layer: { name: "Layer 2" },
        geometricBounds: [0, 50, 50, 30],
      },
    ] as unknown as TextFrame[];

    const results = checkLiveText(mockTextFrames);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.severity === "ERROR")).toBe(true);
  });

  it("TEXT-01: bounds は Array.isArray() が true のプレーン JS 配列として返る (Illustratorネイティブ配列対策)", () => {
    const nativeLike = Object.assign(Object.create(null), {
      0: 0,
      1: 100,
      2: 200,
      3: 80,
      length: 4,
    });
    const mockTextFrames = [
      {
        contents: "テキスト",
        name: "text",
        layer: { name: "Layer 1" },
        geometricBounds: nativeLike,
      },
    ] as unknown as TextFrame[];

    const results = checkLiveText(mockTextFrames);

    expect(results).toHaveLength(1);
    expect(Array.isArray(results[0].bounds)).toBe(true);
    expect(results[0].bounds).toEqual([0, 100, 200, 80]);
  });
});

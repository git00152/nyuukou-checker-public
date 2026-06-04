import { describe, it, expect } from "vitest";
import { checkOverprint } from "../../src/jsx/hostscript/checks/checkOverprint";
import type { OverprintItem } from "../../src/jsx/hostscript/checks/checkOverprint";

// CMYK ヘルパー
function cmyk(c: number, m: number, y: number, k: number) {
  return { typename: "CMYKColor", cyan: c, magenta: m, yellow: y, black: k };
}

const BLACK_CMYK = cmyk(0, 0, 0, 100);
const WHITE_CMYK = cmyk(0, 0, 0, 0);
const CYAN_CMYK = cmyk(100, 0, 0, 0);
const NO_COLOR = { typename: "NoColor" };

describe("checkOverprint", () => {
  // --- PathItem 塗り（fillOverprint）---

  it("Test 1: K=100% 黒の塗り fillOverprint=true → 除外（WARNING なし）", () => {
    const items: OverprintItem[] = [
      {
        name: "black-fill",
        fillColor: BLACK_CMYK,
        strokeColor: NO_COLOR,
        fillOverprint: true,
        strokeOverprint: false,
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(0);
  });

  it("Test 2: シアンの塗り fillOverprint=true → WARNING / COLOR_OVERPRINT_01", () => {
    const items: OverprintItem[] = [
      {
        name: "cyan-fill",
        fillColor: CYAN_CMYK,
        strokeColor: NO_COLOR,
        fillOverprint: true,
        strokeOverprint: false,
        geometricBounds: [0, 100, 100, 0],
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("COLOR_OVERPRINT_01");
    expect(results[0].objectName).toBe("cyan-fill");
    expect(results[0].targetRef).toMatchObject({
      kind: "pathItem",
      messageKey: "COLOR_OVERPRINT_01",
      objectName: "cyan-fill",
      collectionIndex: 0,
    });
  });

  it("Test 3: 白（C=0 M=0 Y=0 K=0）の塗り fillOverprint=true → ERROR / COLOR_OVERPRINT_WHITE_01", () => {
    const items: OverprintItem[] = [
      {
        name: "white-fill",
        fillColor: WHITE_CMYK,
        strokeColor: NO_COLOR,
        fillOverprint: true,
        strokeOverprint: false,
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("COLOR_OVERPRINT_WHITE_01");
    expect(results[0].objectName).toBe("white-fill");
  });

  it("Test 4: K=100% 黒の線 strokeOverprint=true → 除外（WARNING なし）", () => {
    const items: OverprintItem[] = [
      {
        name: "black-stroke",
        fillColor: NO_COLOR,
        strokeColor: BLACK_CMYK,
        fillOverprint: false,
        strokeOverprint: true,
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(0);
  });

  it("Test 5: シアンの線 strokeOverprint=true → WARNING", () => {
    const items: OverprintItem[] = [
      {
        name: "cyan-stroke",
        fillColor: NO_COLOR,
        strokeColor: CYAN_CMYK,
        fillOverprint: false,
        strokeOverprint: true,
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("COLOR_OVERPRINT_01");
  });

  it("Test 6: fillOverprint=false, strokeOverprint=false → 検出なし", () => {
    const items: OverprintItem[] = [
      {
        name: "no-overprint",
        fillColor: CYAN_CMYK,
        strokeColor: CYAN_CMYK,
        fillOverprint: false,
        strokeOverprint: false,
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(0);
  });

  // --- テキストフレームのオーバープリント ---

  it("Test 7: 白テキストフレームで fillOverprint=true → ERROR", () => {
    const items: OverprintItem[] = [
      {
        name: "white-text-frame",
        fillColor: WHITE_CMYK,
        strokeColor: NO_COLOR,
        fillOverprint: true,
        strokeOverprint: false,
      },
    ];
    const results = checkOverprint(items);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("COLOR_OVERPRINT_WHITE_01");
  });

  it("Test 8: fillOverprint 取得に失敗（TypeError）→ catch でスキップ（クラッシュしない）", () => {
    // getter が throw するオブジェクトを用意
    const throwingItem = {
      name: "throwing-item",
      fillColor: CYAN_CMYK,
      strokeColor: NO_COLOR,
      get fillOverprint(): boolean {
        throw new TypeError("fillOverprint not accessible");
      },
      strokeOverprint: false,
    };
    // unknown を介してキャスト
    const items = [throwingItem] as unknown as OverprintItem[];
    // クラッシュしないことを確認
    expect(() => checkOverprint(items)).not.toThrow();
    const results = checkOverprint(items);
    // try/catch でスキップされるため結果は 0 件
    expect(results).toHaveLength(0);
  });
});

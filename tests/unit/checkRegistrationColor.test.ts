import { describe, it, expect } from "vitest";
import { checkRegistrationColor } from "../../src/jsx/hostscript/checks/checkRegistrationColor";
import type { ScopeInfo } from "../../src/jsx/hostscript/types";

const scope: ScopeInfo = { bounds: [0, 297, 210, 0], hasIncompleteMarks: false };
const REG = { typename: "SpotColor", spot: { name: "[Registration]" } };
const NONE = { typename: "NoColor" };
const CMYK = { typename: "CMYKColor", cyan: 0, magenta: 0, yellow: 0, black: 100 };
const B = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

function path(overrides: Record<string, unknown>) {
  return {
    typename: "PathItem",
    name: "",
    filled: false,
    stroked: false,
    fillColor: NONE,
    strokeColor: NONE,
    geometricBounds: B(10, 100, 50, 60),
    ...overrides,
  };
}

describe("checkRegistrationColor", () => {
  it("塗りにレジストレーションを使ったオブジェクトは ERROR", () => {
    const results = checkRegistrationColor([path({ filled: true, fillColor: REG })], scope);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("ERROR");
    expect(results[0].messageKey).toBe("COLOR_REGISTRATION_01");
  });

  it("RegistrationColor 型の塗りも ERROR", () => {
    const results = checkRegistrationColor([path({ filled: true, fillColor: { typename: "RegistrationColor" } })], scope);
    expect(results).toHaveLength(1);
  });

  it("断裁範囲の内側にあるレジストレーションの線は ERROR", () => {
    const results = checkRegistrationColor([path({ stroked: true, strokeColor: REG, geometricBounds: B(20, 200, 150, 200) })], scope);
    expect(results).toHaveLength(1);
  });

  it("断裁範囲の外側にあるレジストレーションの線（トンボ）は対象外", () => {
    const tombo = path({ stroked: true, strokeColor: REG, geometricBounds: B(-30, 0, -9, 0) });
    const tomboTop = path({ stroked: true, strokeColor: REG, geometricBounds: B(0, 330, 0, 306) });
    expect(checkRegistrationColor([tombo, tomboTop], scope)).toHaveLength(0);
  });

  it("通常の CMYK は対象外", () => {
    expect(checkRegistrationColor([path({ filled: true, fillColor: CMYK, stroked: true, strokeColor: CMYK })], scope)).toHaveLength(0);
  });

  it("塗りが無効（filled=false）ならレジストレーション色が残っていても対象外", () => {
    expect(checkRegistrationColor([path({ filled: false, fillColor: REG })], scope)).toHaveLength(0);
  });
});

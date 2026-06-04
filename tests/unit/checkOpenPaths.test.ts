import { describe, expect, it } from "vitest";
import { checkOpenPaths } from "../../src/jsx/hostscript/checks/checkOpenPaths";

function makePath(overrides: Record<string, unknown> = {}): PathItem {
  return {
    name: "path-1",
    layer: { name: "Artwork" },
    geometricBounds: [0, 10, 10, 0],
    closed: false,
    filled: false,
    stroked: true,
    strokeWidth: 1,
    pathPoints: [{}, {}],
    ...overrides,
  } as unknown as PathItem;
}

describe("checkOpenPaths", () => {
  it("closed === false のパスを PATH_OPEN_01 として検出する", () => {
    const results = checkOpenPaths([makePath()]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      severity: "WARNING",
      messageKey: "PATH_OPEN_01",
      objectName: "path-1",
      layerName: "Artwork",
      bounds: [0, 10, 10, 0],
      targetRef: expect.objectContaining({ kind: "pathItem", messageKey: "PATH_OPEN_01" }),
    });
    expect(results[0].actions?.map((action) => action.id)).toEqual(["select"]);
  });

  it("closed === false かつ filled === true は PATH_OPEN_FILLED_01 のみ検出する", () => {
    const results = checkOpenPaths([makePath({ filled: true })]);

    expect(results).toHaveLength(1);
    expect(results[0].messageKey).toBe("PATH_OPEN_FILLED_01");
  });

  it("設定 OFF 時は該当検出を出さない", () => {
    expect(checkOpenPaths([makePath()], { detectOpenPaths: false })).toHaveLength(0);
    expect(checkOpenPaths([makePath({ filled: true })], { detectFilledOpenPaths: false })).toHaveLength(1);
    expect(checkOpenPaths([makePath({ filled: true })], {
      detectOpenPaths: false,
      detectFilledOpenPaths: false,
    })).toHaveLength(0);
  });

  it("closed が false 以外のパスは検出しない", () => {
    expect(checkOpenPaths([makePath({ closed: true })])).toHaveLength(0);
    expect(checkOpenPaths([makePath({ closed: undefined })])).toHaveLength(0);
  });
});

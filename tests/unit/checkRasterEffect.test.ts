import { describe, it, expect } from "vitest";
import { checkRasterEffect } from "../../src/jsx/hostscript/checks/checkRasterEffect";
import type { DocumentForRasterEffect } from "../../src/jsx/hostscript/checks/checkRasterEffect";

describe("checkRasterEffect — IMG-06: ラスタライズ効果解像度", () => {
  it("Test 1: rasterEffectSettings.resolution = 150 → WARNING IMG_RASTER_EFFECT_01", () => {
    const doc: DocumentForRasterEffect = { rasterEffectSettings: { resolution: 150 } };
    const results = checkRasterEffect(doc);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("IMG_RASTER_EFFECT_01");
    expect(results[0].message).toMatch(/150dpi/);
  });

  it("Test 2: rasterEffectSettings.resolution = 299 → WARNING", () => {
    const doc: DocumentForRasterEffect = { rasterEffectSettings: { resolution: 299 } };
    const results = checkRasterEffect(doc);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("WARNING");
    expect(results[0].messageKey).toBe("IMG_RASTER_EFFECT_01");
    expect(results[0].message).toMatch(/299dpi/);
  });

  it("Test 3: rasterEffectSettings.resolution = 300 → WARNING なし（OK）", () => {
    const doc: DocumentForRasterEffect = { rasterEffectSettings: { resolution: 300 } };
    const results = checkRasterEffect(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 4: rasterEffectSettings.resolution = 600 → WARNING なし（OK）", () => {
    const doc: DocumentForRasterEffect = { rasterEffectSettings: { resolution: 600 } };
    const results = checkRasterEffect(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 5: rasterEffectSettings が undefined → 空配列を返す（クラッシュしない）", () => {
    const doc: DocumentForRasterEffect = { rasterEffectSettings: undefined };
    const results = checkRasterEffect(doc);
    expect(results).toHaveLength(0);
  });

  it("Test 5b: rasterEffectSettings が null → 空配列を返す（クラッシュしない）", () => {
    const doc: DocumentForRasterEffect = { rasterEffectSettings: null };
    const results = checkRasterEffect(doc);
    expect(results).toHaveLength(0);
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";

describe("cep.config.ts", () => {
  let cepConfig: Awaited<typeof import("../../cep.config")>["default"];

  beforeAll(async () => {
    // dynamic import で最新の cep.config を取得
    const mod = await import("../../cep.config");
    cepConfig = mod.default;
  });

  it("Bundle ID が com.git00152.nyuukochecker である", () => {
    expect(cepConfig.id).toBe("com.git00152.nyuukochecker");
  });

  it("zxp.country がプレースホルダーでない", () => {
    expect(cepConfig.zxp.country).not.toBe("US");
    // process.env.ZXP_COUNTRY が未設定の場合のデフォルト値 "JP" を許容
    expect(["JP", process.env.ZXP_COUNTRY]).toContain(cepConfig.zxp.country);
  });

  it("zxp.org が Company というプレースホルダーでない", () => {
    expect(cepConfig.zxp.org).not.toBe("Company");
  });

  it("zxp.password が password というハードコード値でない", () => {
    expect(cepConfig.zxp.password).not.toBe("password");
  });

  it("cep.config.ts は実行時バンドルへ process.env を混入させない", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "../../cep.config.ts"), "utf8");

    expect(source).not.toContain("process.env");
  });

  it("panels[0].name が main である", () => {
    expect(cepConfig.panels[0].name).toBe("main");
  });

  it("CSXS 11 前提のため Illustrator 25.3 以降を対象にする", () => {
    expect(cepConfig.requiredRuntimeVersion).toBe(11.0);
    expect(cepConfig.hosts).toContainEqual({ name: "ILST", version: "[25.3,99.9]" });
  });
});

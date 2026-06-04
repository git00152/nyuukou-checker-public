import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("README version references", () => {
  it("README は package.json のバージョン入り ZXP 配布ファイル名を案内する", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

    expect(readme).toContain(`nyuukou-checker-v${packageJson.version}.zxp`);
    expect(readme).toContain(`現在のバージョン: v${packageJson.version}`);
  });
});

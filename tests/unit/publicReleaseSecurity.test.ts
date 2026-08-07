import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("public release security boundary", () => {
  it("公開ツリーに配布作成者専用のファイルを含めない", () => {
    const maintainerOnlyPaths = [
      ".env.example",
      "scripts/create-installer.mjs",
      "scripts/create-self-signed-cert.sh",
      "scripts/package-zxp.sh",
      "scripts/verify-extension.sh",
      "tests/scripts/create-installer.test.mjs",
      "tests/scripts/zxp-distribution.test.mjs",
    ];

    for (const relativePath of maintainerOnlyPaths) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(false);
    }
  });

  it("公開 package.json に署名・証明書・開発用インストーラーの script を公開しない", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

    for (const scriptName of ["installer", "verify:cep", "cert:self", "package:zxp", "zxp", "zip"]) {
      expect(packageJson.scripts[scriptName]).toBeUndefined();
    }
  });

  it("公開ビルド設定は dotenv と署名用環境変数を扱わない", () => {
    const viteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");

    expect(viteConfig).not.toContain("dotenv");
    expect(viteConfig).not.toContain("ZXP_CERT_PASSWORD");
  });

  it("公開文書は配布元・SHA-256・セキュリティ方針を案内する", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const security = fs.readFileSync(path.join(root, "SECURITY.md"), "utf8");

    expect(readme).toContain("GitHub Releases");
    expect(readme).toContain("SHA-256");
    expect(security).toContain("SHA-256");
    expect(security).toContain("第三者");
  });
});

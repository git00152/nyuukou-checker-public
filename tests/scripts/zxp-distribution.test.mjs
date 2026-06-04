// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = PACKAGE_JSON.version;

describe("ZXP distribution scripts", () => {
  it("package.json exposes ZXP distribution scripts", () => {
    expect(PACKAGE_JSON.scripts["verify:cep"]).toBe("bash scripts/verify-extension.sh");
    expect(PACKAGE_JSON.scripts["cert:self"]).toBe("bash scripts/create-self-signed-cert.sh");
    expect(PACKAGE_JSON.scripts["package:zxp"]).toBe("bash scripts/package-zxp.sh");
  });

  it("protects certificates, env files, and generated ZXP files from git", () => {
    const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");

    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("*.p12");
    expect(gitignore).toContain("certs/*.p12");
    expect(gitignore).toContain("dist/*.zxp");
    expect(gitignore).toContain("!.env.example");
  });

  it(".env.example documents only placeholder ZXP variables", () => {
    const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");

    expect(envExample).toContain("ZXPSIGNCMD_PATH=/path/to/ZXPSignCmd");
    expect(envExample).toContain("ZXP_CERT_PATH=certs/self-signed.p12");
    expect(envExample).toContain("ZXP_CERT_PASSWORD=change_me");
  });

  it("certificate script fails safely when required env is missing", () => {
    const output = runExpectingFailure("scripts/create-self-signed-cert.sh", {});

    expect(output).toContain("ZXPSIGNCMD_PATH is required");
    expect(output).not.toContain("ZXP_CERT_PASSWORD=");
  });

  it("package script fails safely when required env is missing", () => {
    const output = runExpectingFailure("scripts/package-zxp.sh", {});

    expect(output).toContain("ZXPSIGNCMD_PATH is required");
    expect(output).not.toContain("ZXP_CERT_PASSWORD=");
  });

  it("verify script reads required CEP manifest metadata", () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "nyuukou-cep-"));
    try {
      fs.mkdirSync(path.join(fixtureDir, "CSXS"), { recursive: true });
      fs.mkdirSync(path.join(fixtureDir, "main"), { recursive: true });
      fs.mkdirSync(path.join(fixtureDir, "assets"), { recursive: true });
      fs.mkdirSync(path.join(fixtureDir, "jsx"), { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, "main/index.html"), "<div></div>", "utf8");
      fs.writeFileSync(path.join(fixtureDir, "jsx/index.js"), "var ready = true;", "utf8");
      fs.writeFileSync(
        path.join(fixtureDir, "CSXS/manifest.xml"),
        `<ExtensionManifest ExtensionBundleId="com.git00152.nyuukochecker">
        <ExtensionList><Extension Id="com.git00152.nyuukochecker.main" /></ExtensionList>
        <ExecutionEnvironment>
          <HostList><Host Name="ILST" Version="[25.3,99.9]" /></HostList>
          <RequiredRuntimeList><RequiredRuntime Name="CSXS" Version="11.0" /></RequiredRuntimeList>
        </ExecutionEnvironment>
        <DispatchInfoList><Extension Id="com.git00152.nyuukochecker.main"><DispatchInfo><Resources><MainPath>./main/index.html</MainPath></Resources></DispatchInfo></Extension></DispatchInfoList>
      </ExtensionManifest>`,
        "utf8",
      );

      const output = execFileSync("bash", ["scripts/verify-extension.sh", fixtureDir], {
        cwd: ROOT,
        encoding: "utf8",
      });

      expect(output).toContain("ExtensionBundleId: com.git00152.nyuukochecker");
      expect(output).toContain("Extension Id: com.git00152.nyuukochecker.main");
      expect(output).toContain("MainPath: ./main/index.html");
      expect(output).toContain("RequiredRuntime: 11.0");
      expect(output).toContain("HostList: ILST [25.3,99.9]");
      expect(output).toContain("Result: OK");
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("verify script rejects debug artifacts and source maps", () => {
    const fixtureDir = createCepFixture();
    try {
      fs.writeFileSync(path.join(fixtureDir, ".debug"), "debug", "utf8");
      fs.writeFileSync(path.join(fixtureDir, "assets/main.cjs.map"), "{}", "utf8");

      const output = runExpectingFailure("scripts/verify-extension.sh", {}, [fixtureDir, "--distribution"]);

      expect(output).toContain("forbidden distribution file found");
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("verify script rejects runtime env references and absolute user paths", () => {
    const fixtureDir = createCepFixture();
    try {
      fs.writeFileSync(
        path.join(fixtureDir, "assets/main.cjs"),
        'var password = process.env.ZXP_CERT_PASSWORD; var local = "/Users/example/project";',
        "utf8",
      );

      const output = runExpectingFailure("scripts/verify-extension.sh", {}, [fixtureDir, "--distribution"]);

      expect(output).toContain("forbidden runtime config, secret reference, or absolute user path found");
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("package script signs a sanitized staging directory", () => {
    const script = fs.readFileSync(path.join(ROOT, "scripts/package-zxp.sh"), "utf8");

    expect(script).toContain('STAGING_DIR="$DIST_DIR/.zxp-staging"');
    expect(script).toContain('verify-extension.sh" "$STAGING_DIR" --distribution');
    expect(script).not.toContain('verify-extension.sh" "$EXTENSION_DIR"');
  });

  it("Node bridge loads only the standard modules used by the panel", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/js/lib/cep/node.ts"), "utf8");

    expect(source).toContain('require("child_process")');
    expect(source).toContain('require("fs")');
    expect(source).toContain('require("os")');
    expect(source).not.toContain('require("crypto")');
    expect(source).not.toContain('require("cluster")');
    expect(source).not.toContain('require("zlib")');
  });

  it("README makes signed ZXP the normal distribution path", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

    expect(readme).toContain("この拡張は署名済み ZXP 配布を前提とします");
    expect(readme).toContain(`nyuukou-checker-v${VERSION}.zxp`);
    expect(readme).not.toContain("install-dev.command");
    expect(readme).not.toContain("PlayerDebugMode");
  });

  it("README omits maintainer and developer distribution details", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

    expect(readme).not.toContain("配布作成者・管理者向け情報");
    expect(readme).not.toContain("正式配布では、コード署名用途の証明書または組織で管理する配布用証明書を使用してください");
    expect(readme).not.toContain("GUI で案内する場合は ZXP Installer");
    expect(readme).toContain("https://aescripts.com/learn/zxp-installer/");
    expect(readme).toContain("ZXP Installer をまだ入れていない場合");
    expect(readme).not.toContain("管理者や手順書で一括導入する場合は ExManCmd");
    expect(readme).not.toContain("自己署名証明書は身内検証用です");
    expect(readme).not.toContain("npm install");
    expect(readme).not.toContain("npm run");
    expect(readme).not.toContain("ZXP_CERT_PASSWORD");
  });
});

function createCepFixture() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "nyuukou-cep-"));
  fs.mkdirSync(path.join(fixtureDir, "CSXS"), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, "main"), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, "assets"), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, "jsx"), { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, "main/index.html"), "<div></div>", "utf8");
  fs.writeFileSync(path.join(fixtureDir, "jsx/index.js"), "var ready = true;", "utf8");
  fs.writeFileSync(
    path.join(fixtureDir, "CSXS/manifest.xml"),
    `<ExtensionManifest ExtensionBundleId="com.git00152.nyuukochecker">
      <ExtensionList><Extension Id="com.git00152.nyuukochecker.main" /></ExtensionList>
      <ExecutionEnvironment>
        <HostList><Host Name="ILST" Version="[25.3,99.9]" /></HostList>
        <RequiredRuntimeList><RequiredRuntime Name="CSXS" Version="11.0" /></RequiredRuntimeList>
      </ExecutionEnvironment>
      <DispatchInfoList><Extension Id="com.git00152.nyuukochecker.main"><DispatchInfo><Resources><MainPath>./main/index.html</MainPath></Resources></DispatchInfo></Extension></DispatchInfoList>
    </ExtensionManifest>`,
    "utf8",
  );
  return fixtureDir;
}

function runExpectingFailure(scriptPath, extraEnv, args = []) {
  try {
    execFileSync("bash", [scriptPath, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    return `${error.stdout || ""}${error.stderr || ""}`;
  }
  throw new Error(`${scriptPath} unexpectedly succeeded`);
}

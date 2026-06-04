// @vitest-environment node
// tests/scripts/create-installer.test.mjs
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const DIST_CEP = path.join(ROOT, "dist/cep");
const DIST_INSTALLER = path.join(ROOT, "dist/installer");
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = PACKAGE_JSON.version;
const INSTALLER_DIR_NAME = `入稿データチェッカー-v${VERSION}-installer`;
const INSTALLER_DIR = path.join(DIST_INSTALLER, INSTALLER_DIR_NAME);

// dist/cep が存在しない場合はテストをスキップ
const hasCep = fs.existsSync(DIST_CEP);

describe.skipIf(!hasCep)("create-installer.mjs", () => {
  beforeAll(() => {
    execSync("node scripts/create-installer.mjs", { cwd: ROOT, stdio: "pipe" });
  });

  it("インストーラーディレクトリが生成される", () => {
    expect(fs.existsSync(INSTALLER_DIR)).toBe(true);
  });

  it("install-dev.command が存在する", () => {
    expect(fs.existsSync(path.join(INSTALLER_DIR, "install-dev.command"))).toBe(true);
  });

  it("install-dev.command が実行可能である", () => {
    const stat = fs.statSync(path.join(INSTALLER_DIR, "install-dev.command"));
    // ownerの実行ビット(0o100)が立っていること
    expect(stat.mode & 0o100).toBe(0o100);
  });

  it("install-dev.command に EXT_ID と開発用警告が含まれる", () => {
    const content = fs.readFileSync(path.join(INSTALLER_DIR, "install-dev.command"), "utf8");
    expect(content).toContain("com.git00152.nyuukochecker");
    expect(content).toContain("このインストーラーは開発用です");
  });

  it("extension ディレクトリが存在する", () => {
    expect(fs.existsSync(path.join(INSTALLER_DIR, "extension"))).toBe(true);
  });

  it("extension/CSXS/manifest.xml が存在する", () => {
    expect(fs.existsSync(path.join(INSTALLER_DIR, "extension/CSXS/manifest.xml"))).toBe(true);
  });

  it("README.txt が存在する", () => {
    expect(fs.existsSync(path.join(INSTALLER_DIR, "README.txt"))).toBe(true);
  });

  it("README.txt にバージョンが含まれる", () => {
    const readme = fs.readFileSync(path.join(INSTALLER_DIR, "README.txt"), "utf8");

    expect(readme).toContain(`バージョン: v${VERSION}`);
  });

  it("README.txt に Illustrator でのパネル表示手順が含まれる", () => {
    const readme = fs.readFileSync(path.join(INSTALLER_DIR, "README.txt"), "utf8");

    expect(readme).toContain("ウィンドウ → エクステンション → 入稿データチェッカー");
    expect(readme).not.toContain("ウィンドウ → 機能拡張 → 入稿データチェッカー");
  });

  it("配布用 zip が生成される", () => {
    const zip = path.join(DIST_INSTALLER, `${INSTALLER_DIR_NAME}.zip`);
    expect(fs.existsSync(zip)).toBe(true);
  });

  it("配布用 extension にデバッグ用ファイルと source map を含めない", () => {
    const extensionDir = path.join(INSTALLER_DIR, "extension");
    const files = listFiles(extensionDir).map((file) => path.relative(extensionDir, file));

    expect(files).not.toContain(".debug");
    expect(files.some((file) => file.endsWith(".map"))).toBe(false);
  });

  it("配布用 zip に macOS メタデータ、デバッグ用ファイル、source map を含めない", () => {
    const zip = path.join(DIST_INSTALLER, `${INSTALLER_DIR_NAME}.zip`);
    const output = execSync(`unzip -Z1 ${JSON.stringify(zip)}`, { cwd: ROOT, encoding: "utf8" });
    const files = output.trim().split(/\r?\n/).filter(Boolean);

    expect(files.some((file) => file.includes("__MACOSX/"))).toBe(false);
    expect(files.some((file) => file.endsWith("/extension/.debug"))).toBe(false);
    expect(files.some((file) => file.endsWith(".map"))).toBe(false);
  });
});

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("startup diagnostic logging", () => {
  it("index.html は React bundle 読み込み前に起動ログを初期化する", () => {
    const html = fs.readFileSync(path.join(process.cwd(), "src/js/main/index.html"), "utf8");
    const loggerIndex = html.indexOf("__nyuukouLog");
    const moduleIndex = html.indexOf('src="./index-react.tsx"');

    expect(loggerIndex).toBeGreaterThan(-1);
    expect(moduleIndex).toBeGreaterThan(-1);
    expect(loggerIndex).toBeLessThan(moduleIndex);
    expect(html).toContain("nyuukou-checker.log");
    expect(html).toContain("startup html loaded");
  });

  it("起動ログは Node require('fs') ではなく CEP fs を優先する", () => {
    const html = fs.readFileSync(path.join(process.cwd(), "src/js/main/index.html"), "utf8");

    expect(html).toContain("window.cep.fs.writeFile");
    expect(html).toContain("window.cep.fs.readFile");
    expect(html).toContain("window.__adobe_cep__.getSystemPath");
    expect(html).toContain("nyuukou-checker-startup-log");
    expect(html).not.toContain('require("fs")');
    expect(html).not.toContain("appendFileSync");
  });
});

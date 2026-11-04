// @vitest-environment node
// ExtendScript は BOM のない .js/.jsx を UTF-8 として読まず、macOS 日本語環境では
// Shift_JIS 等として解釈するため、ホストスクリプト内の日本語メッセージが文字化けする。
// 同梱する jsx は ASCII のみ（日本語は \uXXXX）にする。
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeNonAscii } from "../../scripts/extendscript-ascii.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSX_BUNDLE = path.resolve(__dirname, "../../dist/cep/jsx/index.js");

describe("escapeNonAscii", () => {
  it("日本語を \\uXXXX に置き換え、ASCII はそのまま残す", () => {
    expect(escapeNonAscii('var m = "保存";')).toBe('var m = "\\u4fdd\\u5b58";');
  });

  it("サロゲートペアは 2 つの \\u エスケープにする", () => {
    expect(escapeNonAscii("𠮷")).toBe("\\ud842\\udfb7");
  });

  it("置き換え後も同じ文字列として評価される", () => {
    const source = 'var m = "Illustrator保存バージョン（2024）";';
    const escaped = escapeNonAscii(source);
    expect(/^[\x00-\x7f]*$/.test(escaped)).toBe(true);
    expect(new Function(escaped + " return m;")()).toBe("Illustrator保存バージョン（2024）");
  });
});

describe.skipIf(!fs.existsSync(JSX_BUNDLE))("ExtendScript bundle encoding", () => {
  it("ビルド後の jsx は ASCII のみで構成される", () => {
    const src = fs.readFileSync(JSX_BUNDLE, "utf8");
    const lines = src.split("\n").map((line, i) => (/[^\x00-\x7f]/.test(line) ? i + 1 : 0)).filter(Boolean);
    expect(lines.slice(0, 5)).toEqual([]);
  });
});

// @vitest-environment node
// ExtendScript（ES3）のパーサーは、条件演算子の真側に条件演算子やオブジェクトリテラルを
// 置くと「SyntaxError: 予期された結果: :」で読み込みに失敗する。ビルド後の jsx に
// その形が含まれていないことを確認する（dist/cep が無い場合はスキップ）。
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const JSX_BUNDLE = path.join(ROOT, "dist/cep/jsx/index.js");
const hasBundle = fs.existsSync(JSX_BUNDLE);

describe.skipIf(!hasBundle)("ExtendScript bundle syntax", () => {
  it("条件演算子の真側に条件演算子を入れ子にしていない", () => {
    const src = fs.readFileSync(JSX_BUNDLE, "utf8");
    const ast = acorn.parse(src, { ecmaVersion: 3, allowReserved: true, locations: true });
    const lines = [];
    walk.full(ast, (node) => {
      if (node.type === "ConditionalExpression" && node.consequent.type === "ConditionalExpression") {
        lines.push(node.loc.start.line);
      }
    });
    expect(lines).toEqual([]);
  });

  it("条件演算子の真側にオブジェクトリテラルを置いていない", () => {
    const src = fs.readFileSync(JSX_BUNDLE, "utf8");
    const ast = acorn.parse(src, { ecmaVersion: 3, allowReserved: true, locations: true });
    const lines = [];
    walk.full(ast, (node) => {
      if (node.type === "ConditionalExpression" && node.consequent.type === "ObjectExpression") {
        lines.push(node.loc.start.line);
      }
    });
    expect(lines).toEqual([]);
  });
});

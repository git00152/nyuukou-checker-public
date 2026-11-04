/**
 * ExtendScript は BOM のないスクリプトを UTF-8 として読まないため、
 * 同梱する jsx の非 ASCII 文字を \uXXXX に置き換える。
 * 文字列・正規表現リテラル・コメントのどこに現れても意味は変わらない。
 */
export function escapeNonAscii(source) {
  let out = "";
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    out += code > 0x7f ? "\\u" + code.toString(16).padStart(4, "0") : source[i];
  }
  return out;
}

/** rollup の出力段で適用するプラグイン */
export function extendscriptAscii() {
  return {
    name: "extendscript-ascii",
    renderChunk(code) {
      return { code: escapeNonAscii(code), map: null };
    },
  };
}

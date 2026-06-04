import { CheckResult } from "../types";

/**
 * 非表示レイヤーを再帰的に検出する。
 * layer.visible === false（NOT hidden — 逆極性に注意）のレイヤーを WARNING として返す。
 */
function scanLayers(layers: Layer[], results: CheckResult[]): void {
  // ExtendScript 互換: Array.from は ExtendScript（ES3）に存在しないため
  // インデックスループを使用する
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (layer.visible === false) {
      results.push({
        severity: "WARNING",
        messageKey: "LAYER_HIDDEN_01",
        message: "\u975E\u8868\u793A\u30EC\u30A4\u30E4\u30FC\u304C\u5B58\u5728\u3057\u307E\u3059: \"" + layer.name + "\"",
        layerName: layer.name,
      } satisfies CheckResult);
    }
    // サブレイヤーを再帰的に検査
    if (layer.layers && layer.layers.length > 0) {
      scanLayers(layer.layers as unknown as Layer[], results);
    }
  }
}

export function checkHiddenLayers(doc: Document): CheckResult[] {
  const results: CheckResult[] = [];
  scanLayers(doc.layers as unknown as Layer[], results);
  return results;
}

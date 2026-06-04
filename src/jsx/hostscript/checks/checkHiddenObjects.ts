import { CheckResult } from "../types";

/**
 * 「隠す」設定のオブジェクトをレイヤー階層全体から再帰的に検出する。
 * item.hidden === true（NOT visible — 逆極性に注意）のオブジェクトを WARNING として返す。
 */
function scanLayer(layer: Layer, results: CheckResult[]): void {
  // ExtendScript 互換: Array.from は ExtendScript（ES3）に存在しないため
  // インデックスループを使用する
  const pageItems = (layer as unknown as { pageItems: PageItem[] }).pageItems;
  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    if (item.hidden === true) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = item.geometricBounds as unknown as { [i: number]: number };
      results.push({
        severity: "WARNING",
        messageKey: "LAYER_HIDDEN_OBJ_01",
        message: "\u300C\u96A0\u3059\u300D\u8A2D\u5B9A\u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u304C\u5B58\u5728\u3057\u307E\u3059",
        objectName: item.name,
        layerName: layer.name,
        bounds: [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number],
      } satisfies CheckResult);
    }
  }
  // サブレイヤーを再帰的に検査
  const subLayers = (layer as unknown as { layers: Layer[] }).layers;
  if (subLayers && subLayers.length > 0) {
    for (let j = 0; j < subLayers.length; j++) {
      scanLayer(subLayers[j], results);
    }
  }
}

export function checkHiddenObjects(doc: Document): CheckResult[] {
  const results: CheckResult[] = [];
  const layers = doc.layers as unknown as Layer[];
  for (let i = 0; i < layers.length; i++) {
    scanLayer(layers[i], results);
  }
  return results;
}

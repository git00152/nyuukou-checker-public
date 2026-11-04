import { CheckResult } from "../types";
import { visitDocumentItems } from "../inspector";

export function checkHiddenObjects(doc: Document, bounds?: [number, number, number, number]): CheckResult[] {
  var results: CheckResult[] = [];
  // ExtendScript (ES3) 互換: 条件演算子の真側にオブジェクトリテラルを書くと
  // 読み込み時に「SyntaxError: 予期された結果: :」になるため if 文で組み立てる。
  var visitOptions: { bounds: [number, number, number, number] } | undefined = undefined;
  if (bounds) visitOptions = { bounds: bounds };
  visitDocumentItems(doc, function (item, layer) {
    if ((item as unknown as { guides?: boolean }).guides === true) return;
    if (item.hidden !== true) return;
    var gb = item.geometricBounds;
    results.push({
      severity: "WARNING",
      messageKey: "LAYER_HIDDEN_OBJ_01",
      message: "\u300C\u96A0\u3059\u300D\u8A2D\u5B9A\u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u304C\u5B58\u5728\u3057\u307E\u3059",
      objectName: item.name,
      layerName: item.layer ? item.layer.name : layer.name,
      bounds: [gb[0], gb[1], gb[2], gb[3]],
    });
  }, visitOptions);
  return results;
}

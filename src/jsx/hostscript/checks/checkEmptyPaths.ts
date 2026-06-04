import { CheckResult } from "../types";
import { createPathItemTargetRef, SELECT_ACTION } from "./targetRef";

export function checkEmptyPaths(pathItems: PathItem[]): CheckResult[] {
  const results: CheckResult[] = [];

  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < pathItems.length; i++) {
    const item = pathItems[i];
    const p = item as unknown as {
      filled: boolean;
      stroked: boolean;
      clipping?: boolean;
      name: string;
      layer?: { name: string };
      geometricBounds: [number, number, number, number];
    };

    if (p.clipping) continue;

    if (p.filled === false && p.stroked === false) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = p.geometricBounds;
      const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
      results.push({
        id: "PATH_EMPTY_01:" + i,
        severity: "WARNING",
        messageKey: "PATH_EMPTY_01",
        message: "\u5857\u308A\u306A\u3057\u30FB\u7DDA\u306A\u3057\u306E\u7A7A\u30D1\u30B9\u304C\u5B58\u5728\u3057\u307E\u3059",
        objectName: p.name,
        layerName: p.layer?.name,
        bounds,
        targetRef: createPathItemTargetRef(p, "PATH_EMPTY_01", i, bounds),
        actions: [SELECT_ACTION],
      });
    }
  }

  return results;
}

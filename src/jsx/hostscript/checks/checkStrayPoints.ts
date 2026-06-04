import { CheckResult } from "../types";
import { createPathItemTargetRef, DELETE_ACTION, SELECT_ACTION } from "./targetRef";

export function checkStrayPoints(pathItems: PathItem[]): CheckResult[] {
  const results: CheckResult[] = [];

  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < pathItems.length; i++) {
    const item = pathItems[i];
    const p = item as unknown as {
      pathPoints: unknown[];
      name: string;
      layer?: { name: string };
      geometricBounds: [number, number, number, number];
    };

    if (p.pathPoints.length === 1) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = p.geometricBounds;
      const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
      results.push({
        id: "PATH_STRAY_01:" + i,
        severity: "WARNING",
        messageKey: "PATH_STRAY_01",
        message: "\u30A2\u30F3\u30AB\u30FC\u30DD\u30A4\u30F3\u30C8\u306E\u307F\u306E\u30D1\u30B9\uFF08\u5B64\u7ACB\u70B9\uFF09\u304C\u5B58\u5728\u3057\u307E\u3059",
        objectName: p.name,
        layerName: p.layer?.name,
        bounds,
        targetRef: createPathItemTargetRef(p, "PATH_STRAY_01", i, bounds),
        actions: [SELECT_ACTION, DELETE_ACTION],
      });
    }
  }

  return results;
}

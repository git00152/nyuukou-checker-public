import { CheckResult } from "../types";
import { createPathItemTargetRef, SELECT_ACTION } from "./targetRef";

const THIN_LINE_THRESHOLD_PT = 0.284; // 0.1mm = 0.28346pt（0.284 > 0.28346 で正しく捕捉）

export function checkThinLines(pathItems: PathItem[]): CheckResult[] {
  const results: CheckResult[] = [];

  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < pathItems.length; i++) {
    const item = pathItems[i];
    const p = item as unknown as {
      stroked: boolean;
      strokeWidth: number;
      name: string;
      layer?: { name: string };
      geometricBounds: [number, number, number, number];
    };

    if (p.stroked === true && p.strokeWidth < THIN_LINE_THRESHOLD_PT) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = p.geometricBounds;
      const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
      results.push({
        id: "PATH_THIN_LINE_01:" + i,
        severity: "WARNING",
        messageKey: "PATH_THIN_LINE_01",
        message: "\u7DDA\u5E45 " + p.strokeWidth.toFixed(3) + "pt\uFF080.1mm \u672A\u6E80\uFF09\u306E\u7D30\u7DDA\u304C\u5B58\u5728\u3057\u307E\u3059",
        objectName: p.name,
        layerName: p.layer?.name,
        bounds,
        targetRef: createPathItemTargetRef(p, "PATH_THIN_LINE_01", i, bounds),
        actions: [SELECT_ACTION],
      });
    }
  }

  return results;
}

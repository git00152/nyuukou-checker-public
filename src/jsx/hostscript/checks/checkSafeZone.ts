import type { CheckResult, ScopeInfo } from "../types";
import { isInsideSafeZone } from "../utils/coordinateUtils";
import { createTextFrameTargetRef } from "./targetRef";

export interface SafeZoneItem {
  name: string;
  geometricBounds: [number, number, number, number];
}

export function checkSafeZone(textFrames: SafeZoneItem[], scope: ScopeInfo): CheckResult[] {
  const results: CheckResult[] = [];
  // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
  for (let i = 0; i < textFrames.length; i++) {
    const tf = textFrames[i];
    if (!isInsideSafeZone(tf.geometricBounds, scope.bounds)) {
      // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
      // json2.js でシリアライズすると {"0":x,...} になる場合がある。
      // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
      const gb = tf.geometricBounds;
      const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
      results.push({
        severity: "WARNING",
        messageKey: "BLEED_SAFE_ZONE_01",
        message: "\u30BB\u30FC\u30D5\u30BE\u30FC\u30F3\u5916: \"" + tf.name + "\" \u304C\u30A2\u30FC\u30C8\u30DC\u30FC\u30C9\u5185\u5074 3mm \u306E\u30BB\u30FC\u30D5\u30BE\u30FC\u30F3\u304B\u3089\u306F\u307F\u51FA\u3057\u3066\u3044\u307E\u3059\u3002\u65AD\u88C1\u6642\u306B\u6587\u5B57\u304C\u5207\u308C\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002",
        objectName: tf.name,
        bounds,
        targetRef: createTextFrameTargetRef(tf, "BLEED_SAFE_ZONE_01", i, bounds),
      });
    }
  }
  return results;
}

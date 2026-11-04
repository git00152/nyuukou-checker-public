import type { CheckResult, ScopeInfo } from "../types";
import { isInsideSafeZone } from "../utils/coordinateUtils";
import { createTextFrameTargetRef } from "./targetRef";

export interface SafeZoneItem {
  name: string;
  geometricBounds: [number, number, number, number];
}

export function checkSafeZone(textFrames: SafeZoneItem[], scope: ScopeInfo): CheckResult[] {
  const results: CheckResult[] = [];
  // トンボ候補の方向・四隅が一意に確定していない場合、推定範囲を
  // WARNING の根拠にせず、利用者確認が必要な Information に留める。
  const uncertainScope = scope.scopeSource === "trim-marks" && scope.confidence !== "high";
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
        severity: uncertainScope ? "INFO" : "WARNING",
        messageKey: "BLEED_SAFE_ZONE_01",
        message: (uncertainScope ? "セーフゾーン要確認: \"" : "セーフゾーン外: \"") + tf.name + "\" がアートボード内側 3mm のセーフゾーンからはみ出しています。断裁時に文字が切れる可能性があります。",
        objectName: tf.name,
        bounds,
        targetRef: createTextFrameTargetRef(tf, "BLEED_SAFE_ZONE_01", i, bounds),
      });
    }
  }
  return results;
}

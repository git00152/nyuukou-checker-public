import { CheckResult } from "../types";
import { createTextFrameTargetRef } from "./targetRef";

/**
 * ライブテキスト（アウトライン化されていない TextFrame）を検出する。
 * TextFrame が存在するだけでアウトライン未処理とみなし、全フレームを ERROR として返す。
 *
 * ExtendScript (ES3) 互換: Array.prototype.map は ES5 のため存在しない場合がある。
 * インデックスループを使用する。
 */
export function checkLiveText(textFrames: TextFrame[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (let i = 0; i < textFrames.length; i++) {
    const tf = textFrames[i];
    const raw = tf.contents;
    const preview = raw.length > 20 ? raw.substring(0, 20) + "..." : raw;
    // ExtendScript 互換: geometricBounds は Illustrator ネイティブ配列のため
    // json2.js でシリアライズすると {"0":x,...} になる場合がある。
    // プレーン JS 配列に変換して確実に JSON 配列形式でシリアライズされるようにする。
    const gb = tf.geometricBounds;
    const bounds = [gb[0], gb[1], gb[2], gb[3]] as [number, number, number, number];
    results.push({
      severity: "ERROR",
      messageKey: "TEXT_LIVE_01",
      message: "\u30E9\u30A4\u30D6\u30C6\u30AD\u30B9\u30C8\u304C\u6B8B\u5B58\u3057\u3066\u3044\u307E\u3059: \"" + preview + "\"",
      objectName: tf.name,
      layerName: tf.layer ? tf.layer.name : undefined,
      bounds: bounds,
      targetRef: createTextFrameTargetRef(tf, "TEXT_LIVE_01", i, bounds),
    });
  }
  return results;
}

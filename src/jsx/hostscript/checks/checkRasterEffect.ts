import type { CheckResult } from "../types";

export interface DocumentForRasterEffect {
  rasterEffectSettings?: { resolution: number } | null;
}

const RASTER_EFFECT_RESOLUTION_THRESHOLD = 300;

/**
 * ドキュメントのラスタライズ効果の解像度をチェックする（IMG-06）。
 * rasterEffectSettings.resolution が 300dpi 未満の場合 WARNING を返す。
 * rasterEffectSettings が存在しない場合（古い Illustrator）は空配列を返す。
 *
 * @param doc  チェック対象のドキュメント
 */
export function checkRasterEffect(doc: DocumentForRasterEffect): CheckResult[] {
  try {
    const settings = doc.rasterEffectSettings;
    if (!settings) return [];
    const res = settings.resolution;
    if (res < RASTER_EFFECT_RESOLUTION_THRESHOLD) {
      return [
        {
          severity: "WARNING",
          messageKey: "IMG_RASTER_EFFECT_01",
          message: "\u30E9\u30B9\u30BF\u30E9\u30A4\u30BA\u52B9\u679C\u306E\u89E3\u50CF\u5EA6\u304C " + res + "dpi\uFF08" + RASTER_EFFECT_RESOLUTION_THRESHOLD + "dpi \u672A\u6E80\uFF09\u3067\u3059\u3002\u52B9\u679C\u306E\u54C1\u8CEA\u304C\u4F4E\u4E0B\u3059\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002",
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

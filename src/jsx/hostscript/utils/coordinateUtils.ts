// coordinateUtils.ts — Illustrator 座標系ユーティリティ
// Illustrator 座標系: Y 軸上向き (top > bottom)
// 3mm をポイントに変換: 3 * (72 / 25.4) ≈ 8.5039

/** 塗り足し 3mm をポイントに変換した定数 */
export const BLEED_PT = 3 * (72 / 25.4);

/** セーフゾーン 3mm をポイントに変換した定数 */
export const SAFE_ZONE_PT = 3 * (72 / 25.4);

/** Illustrator 座標系の矩形 (Y 軸上向き: top > bottom) */
export interface Rect {
  left: number;
  top: number;    // Illustrator: top > bottom (Y 上向き)
  right: number;
  bottom: number;
}

/**
 * artboardRect の配列 [L, T, R, B] を Rect に変換
 * artboard.artboardRect は [left, top, right, bottom] の順
 */
export function artboardRectToRect(r: [number, number, number, number]): Rect {
  return { left: r[0], top: r[1], right: r[2], bottom: r[3] };
}

/**
 * geometricBounds の配列 [L, T, R, B] を Rect に変換
 * item.geometricBounds は [left, top, right, bottom] の順
 */
export function geometricBoundsToRect(bounds: [number, number, number, number]): Rect {
  return { left: bounds[0], top: bounds[1], right: bounds[2], bottom: bounds[3] };
}

/**
 * 塗り足し不足チェック: アートボード端に接するオブジェクトが bleed zone に到達しているか
 * 到達していない場合 true（WARNING 対象）
 *
 * 塗り足しとは: 背景画像などがアートボードの端から最低 3mm 外側まで伸びていること。
 * アートボード内側にのみ存在するオブジェクト（テキスト・アイコン等）は塗り足し不要。
 *
 * 判定ロジック:
 *   1. オブジェクトがアートボード端に「接触」しているか確認
 *      （bounds がアートボード境界まで届いていること）
 *   2. 接触している辺で bleed zone（3mm 外側）まで届いているか確認
 *   3. 接触しているのに bleed zone 未到達 → true（WARNING 対象）
 *   4. どの辺にも接触していない（完全に内側）→ false（塗り足し不要）
 *
 * Y 軸上向きのため:
 *   - 接触: item.left <= ab.left / item.top >= ab.top / item.right >= ab.right / item.bottom <= ab.bottom
 *   - bleed zone: left -= BLEED_PT / top += BLEED_PT / right += BLEED_PT / bottom -= BLEED_PT
 */
export function isOutsideBleedZone(
  itemBounds: [number, number, number, number],
  artboardBounds: [number, number, number, number]
): boolean {
  const ab = artboardRectToRect(artboardBounds);
  const item = geometricBoundsToRect(itemBounds);

  // bleed zone: artboard を BLEED_PT だけ外側に拡張した矩形
  const bleedLeft = ab.left - BLEED_PT;
  const bleedTop = ab.top + BLEED_PT;       // Y 上向き: 外側 = top が増加
  const bleedRight = ab.right + BLEED_PT;
  const bleedBottom = ab.bottom - BLEED_PT; // Y 上向き: 外側 = bottom が減少

  // アートボード各辺に「接触」しているか（オブジェクトの辺がアートボード端に達している）
  const touchesLeft = item.left <= ab.left;
  const touchesTop = item.top >= ab.top;
  const touchesRight = item.right >= ab.right;
  const touchesBottom = item.bottom <= ab.bottom;

  // どの端にも接触していない → 完全にアートボード内側 → 塗り足し不要
  if (!touchesLeft && !touchesTop && !touchesRight && !touchesBottom) {
    return false;
  }

  // 接触している辺で bleed zone に届いていない場合は WARNING
  // BLEED_EPSILON: Illustrator 座標値と JS 浮動小数点変換による微小誤差を吸収する許容値
  // bleed 境界ぴったりに配置されたオブジェクトが誤検知されるのを防ぐ
  const BLEED_EPSILON = 0.1; // 0.1pt ≈ 0.035mm 浮動小数点誤差許容
  if (touchesLeft && item.left > bleedLeft + BLEED_EPSILON) return true;
  if (touchesTop && item.top < bleedTop - BLEED_EPSILON) return true;
  if (touchesRight && item.right < bleedRight - BLEED_EPSILON) return true;
  if (touchesBottom && item.bottom > bleedBottom + BLEED_EPSILON) return true;

  return false;
}

/**
 * セーフゾーンチェック: テキストが artboard 内側 3mm (safe zone) に収まっているか
 * 収まっている場合 true（OK）、収まっていない場合 false（WARNING 対象）
 *
 * セーフゾーンとは: テキスト等の重要コンテンツがアートボードの端から最低 3mm 内側に収まること
 * safe zone = artboard を SAFE_ZONE_PT だけ内側に縮小した矩形
 * Y 軸上向きのため:
 *   - 内側 top = artboard.top - SAFE_ZONE_PT
 *   - 内側 bottom = artboard.bottom + SAFE_ZONE_PT
 *
 * SAFE_EPSILON: Illustrator の座標値と JS の浮動小数点変換による微小誤差を吸収する許容値
 * セーフゾーン境界ぴったりに配置されたオブジェクトが誤検知されるのを防ぐ
 */
const SAFE_EPSILON = 0.1; // 0.1pt ≈ 0.035mm 浮動小数点誤差許容

export function isInsideSafeZone(
  itemBounds: [number, number, number, number],
  artboardBounds: [number, number, number, number]
): boolean {
  const ab = artboardRectToRect(artboardBounds);
  const item = geometricBoundsToRect(itemBounds);

  // safe zone: artboard を SAFE_ZONE_PT だけ内側に縮小した矩形
  const safeLeft = ab.left + SAFE_ZONE_PT;
  const safeTop = ab.top - SAFE_ZONE_PT;       // Y 上向き: 内側 = top が減少
  const safeRight = ab.right - SAFE_ZONE_PT;
  const safeBottom = ab.bottom + SAFE_ZONE_PT; // Y 上向き: 内側 = bottom が増加

  // アイテムが safe zone に完全に収まっているか確認
  // SAFE_EPSILON で浮動小数点誤差を吸収（境界ぴったりのオブジェクトを誤警告しない）
  return (
    item.left >= safeLeft - SAFE_EPSILON &&
    item.top <= safeTop + SAFE_EPSILON &&
    item.right <= safeRight + SAFE_EPSILON &&
    item.bottom >= safeBottom - SAFE_EPSILON
  );
}

/**
 * アートボードとオブジェクトが重なっているか確認
 * アートボード外に完全に存在するオブジェクトは検出範囲外とする
 *
 * Y 軸上向き (top > bottom) のため完全に外にある条件:
 *   - 完全に左: iR < aL
 *   - 完全に右: iL > aR
 *   - 完全に下: iT < aB (item の top が artboard の bottom より低い)
 *   - 完全に上: iB > aT (item の bottom が artboard の top より高い)
 *
 * @returns true: アートボードと重なっている（検出対象）
 *          false: アートボード外に完全にある（検出範囲外）
 */
export function overlapsArtboard(
  itemBounds: [number, number, number, number],
  artboardBounds: [number, number, number, number]
): boolean {
  const iL = itemBounds[0], iT = itemBounds[1], iR = itemBounds[2], iB = itemBounds[3];
  const aL = artboardBounds[0], aT = artboardBounds[1], aR = artboardBounds[2], aB = artboardBounds[3];
  // 「完全に外にある」条件の否定 = 重なっている
  return !(iR < aL || iL > aR || iT < aB || iB > aT);
}

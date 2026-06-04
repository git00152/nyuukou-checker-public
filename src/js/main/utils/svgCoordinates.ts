/**
 * Illustrator 座標系 (Y軸上向き) から SVG 座標系 (Y軸下向き) への変換ユーティリティ。
 *
 * ## 座標系の違い
 * - Illustrator: bounds = [left, top, right, bottom]
 *   top > bottom (上が大きい値、Y軸上向き)
 * - SVG: x, y, width, height
 *   y=0 が上、Y軸下向き
 *
 * ## 使い方（重要: viewBox との対応関係）
 * scopeToViewBox() と ilBoundsToSvgRect() はセットで使う。
 * scopeToViewBox() が生成する viewBox 形式 ("${sL} ${sB} W H") を SVG に設定した上で、
 * ilBoundsToSvgRect() の戻り値 (x, y) をそのまま SVG 要素の座標として使える。
 *
 * viewBox を "0 0 W H" に変更した場合は x/y の正規化が別途必要になる。
 */

export interface SvgRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ScopeInfo.bounds から SVG viewBox 文字列を生成する。
 *
 * @param scope - Illustrator 座標系のスコープ bounds: [left, top, right, bottom]
 *                top > bottom (sT が最大Y値)
 * @returns viewBox 文字列 "${sL} ${sB} ${scopeW} ${scopeH}"
 *
 * この viewBox 形式を SVG に設定することで、ilBoundsToSvgRect() の x/y をそのまま
 * SVG 要素の座標として使える (0-based 正規化不要)。
 */
export function scopeToViewBox(scope: [number, number, number, number]): string {
  // インデックスアクセスを使用: ExtendScript の artboardRect が
  // Illustrator ネイティブ配列のまま JSON.stringify → parse されると
  // {"0":x,"1":y,...} 形式になる場合があり、配列分割代入が失敗するため
  const sL = scope[0];
  const sT = scope[1];
  const sR = scope[2];
  const sB = scope[3];
  const scopeW = sR - sL;
  const scopeH = sT - sB;
  return `${sL} ${sB} ${scopeW} ${scopeH}`;
}

/**
 * Illustrator geometricBounds [left, top, right, bottom] (Y軸上向き) を
 * SVG 座標系 (Y軸下向き) の SvgRect に変換する。
 *
 * @param bounds - 変換する Illustrator bounds: [left, top, right, bottom]、またはundefined
 * @param scope  - スコープの Illustrator bounds: [left, top, right, bottom]
 * @returns SvgRect、または bounds が undefined/null の場合は null
 *
 * 前提: SVG の viewBox は scopeToViewBox(scope) で生成した値を使うこと。
 * viewBox が "0 0 W H" の場合は x/y の正規化が別途必要になる (RESEARCH.md Pitfall 2)。
 *
 * Y軸変換式 (RESEARCH.md Pitfall 1):
 *   y = sT - ilTop  (sT = scope[1] = スコープの top = 最大Y値)
 */
export function ilBoundsToSvgRect(
  bounds: [number, number, number, number] | undefined,
  scope: [number, number, number, number]
): SvgRect | null {
  if (bounds == null) {
    return null;
  }

  // インデックスアクセスを使用: ExtendScript の geometricBounds が
  // Illustrator ネイティブ配列のまま JSON.stringify → parse されると
  // {"0":x,"1":y,...} 形式になる場合があり、配列分割代入が失敗するため
  const ilL = bounds[0];
  const ilT = bounds[1];
  const ilR = bounds[2];
  const ilB = bounds[3];
  const sT = scope[1]; // スコープの top = 最大Y値
  const sB = scope[3]; // スコープの bottom = 最小Y値

  // Y軸変換: Illustrator Y上向き → SVG Y下向き
  // viewBox = "sL sB W H" のとき y_min=sB なので:
  //   y_svg = sT - ilT + sB
  // 検証:
  //   ilT = sT (上端) → y_svg = 0 + sB = sB = viewBox y_min (上端) ✓
  //   ilT = sB (下端) → y_svg = sT - sB + sB = sT = viewBox y_max (下端) ✓
  // sB=0 の場合は y_svg = sT - ilT (従来式と一致) ✓
  return {
    x: ilL,                // X軸: Illustrator と SVG で同方向のためそのまま
    y: sT - ilT + sB,      // Y軸: 反転 + viewBox オフセット補正
    width: ilR - ilL,      // 幅: 常に正の値 (ilR > ilL)
    height: ilT - ilB,     // 高さ: 常に正の値 (ilT > ilB)
  };
}

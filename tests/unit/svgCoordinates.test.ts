import { describe, it, expect } from 'vitest';
import { scopeToViewBox, ilBoundsToSvgRect } from '../../src/js/main/utils/svgCoordinates';

// A4縦スコープ: [left, top, right, bottom] = [0, 297, 210, 0]
// sT = 297 (最大Y値), sB = 0, sL = 0, sR = 210
const A4_SCOPE: [number, number, number, number] = [0, 297, 210, 0];

describe('scopeToViewBox', () => {
  it('Test 1: A4縦スコープから "0 0 210 297" の viewBox を生成する', () => {
    // viewBox = "${sL} ${sB} ${sR - sL} ${sT - sB}" = "0 0 210 297"
    expect(scopeToViewBox(A4_SCOPE)).toBe('0 0 210 297');
  });

  it('Test 6 (scope): 負の座標を持つ bleed 込みスコープでも正しく viewBox を生成する', () => {
    // [-8.504, 305.504, 218.504, -8.504]
    // viewBox = "${sL} ${sB} ${sR - sL} ${sT - sB}"
    //         = "-8.504 -8.504 ~227.008 ~314.008"
    // 浮動小数点演算の精度誤差を許容するため、各値を個別に検証する
    const bleedScope: [number, number, number, number] = [-8.504, 305.504, 218.504, -8.504];
    const viewBox = scopeToViewBox(bleedScope);
    const parts = viewBox.split(' ').map(Number);
    expect(parts[0]).toBeCloseTo(-8.504, 3);
    expect(parts[1]).toBeCloseTo(-8.504, 3);
    expect(parts[2]).toBeCloseTo(227.008, 3);
    expect(parts[3]).toBeCloseTo(314.008, 3);
  });
});

describe('ilBoundsToSvgRect', () => {
  it('Test 2: アートボード中央の正方形 [80, 200, 130, 150] が {x:80, y:97, width:50, height:50} を返す', () => {
    // y = sT - ilTop = 297 - 200 = 97
    const result = ilBoundsToSvgRect([80, 200, 130, 150], A4_SCOPE);
    expect(result).toEqual({ x: 80, y: 97, width: 50, height: 50 });
  });

  it('Test 3: アートボード左上角 [0, 297, 10, 287] が {x:0, y:0, width:10, height:10} を返す', () => {
    // y = sT - ilTop = 297 - 297 = 0
    const result = ilBoundsToSvgRect([0, 297, 10, 287], A4_SCOPE);
    expect(result).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('Test 4: アートボード右下角 [200, 10, 210, 0] が {x:200, y:287, width:10, height:10} を返す', () => {
    // y = sT - ilTop = 297 - 10 = 287
    const result = ilBoundsToSvgRect([200, 10, 210, 0], A4_SCOPE);
    expect(result).toEqual({ x: 200, y: 287, width: 10, height: 10 });
  });

  it('Test 5: bounds が undefined の場合に null を返す', () => {
    const result = ilBoundsToSvgRect(undefined, A4_SCOPE);
    expect(result).toBeNull();
  });

  it('Test 6: 負の座標を持つ bleed 込みスコープでも正しく変換される', () => {
    // bleedScope: [-8.504, 305.504, 218.504, -8.504]
    // sT = 305.504, sB = -8.504
    // bounds: [0, 297, 210, 0] (A4縦をスコープ内で変換)
    // y = sT - ilTop + sB = 305.504 - 297 + (-8.504) = 0
    //   (bleed 8.504mm 分 = アートボード上端が y=0、bleed 領域上端が y=sB=-8.504)
    // 浮動小数点演算の精度誤差を許容するため toBeCloseTo で検証する
    const bleedScope: [number, number, number, number] = [-8.504, 305.504, 218.504, -8.504];
    const result = ilBoundsToSvgRect([0, 297, 210, 0], bleedScope);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(0, 3);
    expect(result!.y).toBeCloseTo(0, 3);
    expect(result!.width).toBeCloseTo(210, 3);
    expect(result!.height).toBeCloseTo(297, 3);
  });

  it('Test 7: sB > 0 のスコープ（実Illustratorでアートボードが原点から離れた位置にある場合）', () => {
    // 実Illustratorから報告されたケース
    // scopeInfo.bounds = [508.058, 787.411, 1154.124, 546.985]
    // sL=508.058, sT=787.411, sR=1154.124, sB=546.985
    // viewBox = "508.058 546.985 646.066 240.426" (y_min=sB=546.985)
    // オブジェクト bounds = [600, 750, 800, 700] (スコープ内にある)
    // y = sT - ilTop + sB = 787.411 - 750 + 546.985 = 584.396
    // この y=584.396 は viewBox 有効範囲 [546.985, 787.411] 内にある
    const scope: [number, number, number, number] = [508.058, 787.411, 1154.124, 546.985];
    const result = ilBoundsToSvgRect([600, 750, 800, 700], scope);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(600, 3);
    expect(result!.y).toBeCloseTo(584.396, 3); // 787.411 - 750 + 546.985
    expect(result!.width).toBeCloseTo(200, 3);
    expect(result!.height).toBeCloseTo(50, 3);
  });

  it('Test 8: sB > 0 スコープのアートボード自身の変換（y が viewBox 上端になること）', () => {
    // scope = bounds = [508.058, 787.411, 1154.124, 546.985]
    // アートボード自身: ilT = sT = 787.411
    // y = sT - ilT + sB = 787.411 - 787.411 + 546.985 = 546.985 (= sB = viewBox y_min)
    const scope: [number, number, number, number] = [508.058, 787.411, 1154.124, 546.985];
    const result = ilBoundsToSvgRect([508.058, 787.411, 1154.124, 546.985], scope);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(508.058, 3);
    expect(result!.y).toBeCloseTo(546.985, 3); // = sB = viewBox y_min
    expect(result!.width).toBeCloseTo(646.066, 3);
    expect(result!.height).toBeCloseTo(240.426, 3);
  });
});

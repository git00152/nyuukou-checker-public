import { describe, it, expect } from "vitest";
import { detectInspectionScope } from "../../src/jsx/hostscript/checks/checkTrimMarks";

// ExtendScript 互換性テスト:
// Illustrator のネイティブコレクション (layers, pageItems) は Array ではなく
// Symbol.iterator を持たない。for...of ではなく for(var i) ループを使う必要がある。
// このテストは Array-like オブジェクト（length + 数値インデックス、Arrayではない）を
// layers/pageItems として渡し、正常動作することを検証する。
describe("detectInspectionScope — ExtendScript 互換性", () => {
  it("COMPAT-01: layers が Array でない array-like オブジェクトでもクラッシュしない", () => {
    // Illustrator の Layers コレクション相当: length と数値インデックスを持つがArrayではない
    const arrayLikeLayers = Object.assign(Object.create(null), {
      0: { pageItems: [], layers: [] as unknown as { length: number; [n: number]: unknown } },
      length: 1,
      [Symbol.iterator]: undefined,
    }) as unknown as Document["layers"];

    const mockDoc = {
      layers: arrayLikeLayers,
      artboards: [{ artboardRect: [0, 297, 210, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    // for...of を使っていると ExtendScript 同様に throw する
    // for(var i) を使っていれば正常に動く
    expect(() => detectInspectionScope(mockDoc)).not.toThrow();
  });

  it("COMPAT-02: pageItems が Array でない array-like オブジェクトでもクラッシュしない", () => {
    const arrayLikePageItems = Object.assign(Object.create(null), {
      0: {
        typename: "PathItem",
        stroked: true,
        strokeColor: { typename: "RegistrationColor" },
        // 1本のパスのみでは内周計算が無効（innerLeft > innerRight）→ artboard にフォールバック
        geometricBounds: [10, 100, 110, 0],
      },
      length: 1,
      [Symbol.iterator]: undefined,
    });

    const mockDoc = {
      layers: [{ pageItems: arrayLikePageItems, layers: [] }],
      artboards: [{ artboardRect: [0, 297, 210, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    expect(() => detectInspectionScope(mockDoc)).not.toThrow();
    const result = detectInspectionScope(mockDoc);
    // 単一パスでは内周計算が無効 → artboard フォールバック
    expect(result.bounds).toEqual([0, 297, 210, 0]);
  });
});

describe("detectInspectionScope", () => {
  it("SCOPE-01: CMYKColor 全100 の単一パスをトンボとして検出するが内周計算が無効 → artboard フォールバック", () => {
    // 単一パス [10, 100, 110, 0]: 内周 innerLeft=110 > innerRight=10 → 無効 → artboard へ
    const mockDoc = {
      layers: [
        {
          pageItems: [
            {
              typename: "PathItem",
              stroked: true,
              strokeColor: {
                typename: "CMYKColor",
                cyan: 100,
                magenta: 100,
                yellow: 100,
                black: 100,
              },
              geometricBounds: [10, 100, 110, 0],
            },
          ],
          layers: [],
        },
      ],
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds).toEqual([0, 100, 100, 0]);
    expect(result.hasIncompleteMarks).toBe(false);
  });

  it("SCOPE-01: typename === 'RegistrationColor' の単一パスも検出するが内周計算が無効 → artboard フォールバック", () => {
    const mockDoc = {
      layers: [
        {
          pageItems: [
            {
              typename: "PathItem",
              stroked: true,
              strokeColor: {
                typename: "RegistrationColor",
              },
              geometricBounds: [5, 90, 95, 5],
            },
          ],
          layers: [],
        },
      ],
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // 単一パスでは内周計算が無効 → artboard フォールバック
    expect(result.bounds).toEqual([0, 100, 100, 0]);
    expect(result.hasIncompleteMarks).toBe(false);
  });

  it("SCOPE-01: 非リアルなトンボ複数の場合も内周計算が無効なら artboard フォールバック", () => {
    // 2本のパスで innerLeft=50 > innerRight=20 → 無効 → artboard フォールバック
    const mockDoc = {
      layers: [
        {
          pageItems: [
            {
              typename: "PathItem",
              stroked: true,
              strokeColor: {
                typename: "CMYKColor",
                cyan: 100,
                magenta: 100,
                yellow: 100,
                black: 100,
              },
              geometricBounds: [10, 100, 50, 0],
            },
            {
              typename: "PathItem",
              stroked: true,
              strokeColor: {
                typename: "CMYKColor",
                cyan: 100,
                magenta: 100,
                yellow: 100,
                black: 100,
              },
              geometricBounds: [20, 110, 120, -10],
            },
          ],
          layers: [],
        },
      ],
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // 内周計算: innerLeft=min(50,120)=50, innerRight=max(10,20)=20 → left>right → 無効
    expect(result.bounds).toEqual([0, 100, 100, 0]);
    expect(result.hasIncompleteMarks).toBe(false);
  });

  it("SCOPE-03: リアルなトンボ（コーナーに水平・垂直ライン）がある場合はアートボード境界を正しく抽出する", () => {
    // artboard: [0, 100, 100, 0]、8mm のトンボ 8本（4コーナー × 水平・垂直）
    // 各パスの geometricBounds = [left, top, right, bottom]（ストローク幅 ≈ 0.5pt）
    const trimMarkPaths = [
      // 左上コーナー: 水平（左へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-8, 100.25, 0, 99.75] },
      // 左上コーナー: 垂直（上へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-0.25, 108, 0.25, 100] },
      // 右上コーナー: 水平（右へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [100, 100.25, 108, 99.75] },
      // 右上コーナー: 垂直（上へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [99.75, 108, 100.25, 100] },
      // 左下コーナー: 水平（左へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-8, 0.25, 0, -0.25] },
      // 左下コーナー: 垂直（下へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-0.25, 0, 0.25, -8] },
      // 右下コーナー: 水平（右へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [100, 0.25, 108, -0.25] },
      // 右下コーナー: 垂直（下へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [99.75, 0, 100.25, -8] },
    ];

    const mockDoc = {
      layers: [{ pageItems: trimMarkPaths, layers: [] }],
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // 内周計算: innerLeft=0, innerTop=100, innerRight=100, innerBottom=0 → artboard と一致
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[1]).toBeCloseTo(100, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
    expect(result.bounds[3]).toBeCloseTo(0, 0);
    expect(result.hasIncompleteMarks).toBe(false);
  });

  it("SCOPE-02: トンボが存在しない場合はアートボードの artboardRect を bounds として返す", () => {
    const mockDoc = {
      layers: [
        {
          pageItems: [
            {
              typename: "PathItem",
              stroked: false,
              strokeColor: {
                typename: "RGBColor",
                red: 255,
                green: 0,
                blue: 0,
              },
              geometricBounds: [0, 100, 100, 0],
            },
          ],
          layers: [],
        },
      ],
      artboards: [{ artboardRect: [0, 210, 148, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds).toEqual([0, 210, 148, 0]);
    expect(result.hasIncompleteMarks).toBe(false);
  });

  it("SCOPE-04: トンボが GroupItem の中にある場合も内周を正しく抽出する", () => {
    // Illustrator の「トンボを作成」で生成されるトンボは GroupItem の中に入ることがある
    // artboard: [10, 110, 110, 10]（アートボードをオフセット）
    // トンボの内周: [10, 110, 110, 10]（アートボードと一致させる）
    // グループ traversal なし → artboard フォールバック [10, 110, 110, 10] と同じになってしまうが
    // トンボがある場合の inner bounds は [10, 110, 110, 10] ≠ artboard [20, 120, 120, 20] で区別
    //
    // 実際にはアートボード rect と内周計算結果を別の値にして区別する:
    // artboard: [20, 120, 120, 20]、トンボ内周: [10, 110, 110, 10]
    const trimMarkPaths = [
      // 左上コーナー: 水平（左へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [2, 110.25, 10, 109.75] },
      // 左上コーナー: 垂直（上へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [9.75, 118, 10.25, 110] },
      // 右上コーナー: 水平（右へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [110, 110.25, 118, 109.75] },
      // 右上コーナー: 垂直（上へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [109.75, 118, 110.25, 110] },
      // 左下コーナー: 水平（左へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [2, 10.25, 10, 9.75] },
      // 左下コーナー: 垂直（下へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [9.75, 10, 10.25, 2] },
      // 右下コーナー: 水平（右へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [110, 10.25, 118, 9.75] },
      // 右下コーナー: 垂直（下へ伸びる）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [109.75, 10, 110.25, 2] },
    ];
    // 期待される内周: innerLeft=10, innerTop=110, innerRight=110, innerBottom=10

    // GroupItem としてラップ（pageItems を持つが layers は持たない）
    const groupItem = {
      typename: "GroupItem",
      pageItems: trimMarkPaths,
    };

    const mockDoc = {
      layers: [{
        pageItems: [groupItem],
        layers: [],
      }],
      // artboard は intentionally 別の値: グループ traversal なければ artboard フォールバック
      artboards: [{ artboardRect: [20, 120, 120, 20] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // グループ traversal あれば内周 ≈ [10, 110, 110, 10]
    // なければ artboard フォールバック [20, 120, 120, 20]
    expect(result.bounds[0]).toBeCloseTo(10, 0);
    expect(result.bounds[1]).toBeCloseTo(110, 0);
    expect(result.bounds[2]).toBeCloseTo(110, 0);
    expect(result.bounds[3]).toBeCloseTo(10, 0);
    expect(result.hasIncompleteMarks).toBe(false);
  });

  it("SCOPE-02: pageItems が空の場合はアートボードを範囲とする", () => {
    const mockDoc = {
      layers: [
        {
          pageItems: [],
          layers: [],
        },
      ],
      artboards: [{ artboardRect: [0, 297, 210, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds).toEqual([0, 297, 210, 0]);
    expect(result.hasIncompleteMarks).toBe(false);
  });
});

// センタートンボ除外テスト（四隅のトンボのみで内周計算）
describe("detectInspectionScope — センタートンボ除外", () => {
  // artboard [0, 100, 100, 0]
  // 8 corner paths: inner edges at artboard boundary
  // center marks: inner edges DON'T touch artboard (gap of 5pt) → distort calcInnerBounds without filter
  const cornerPaths = [
    // 左上コーナー: 水平（左へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [-8, 100.25, 0, 99.75] },
    // 左上コーナー: 垂直（上へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [-0.25, 108, 0.25, 100] },
    // 右上コーナー: 水平（右へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [100, 100.25, 108, 99.75] },
    // 右上コーナー: 垂直（上へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [99.75, 108, 100.25, 100] },
    // 左下コーナー: 水平（左へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [-8, 0.25, 0, -0.25] },
    // 左下コーナー: 垂直（下へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [-0.25, 0, 0.25, -8] },
    // 右下コーナー: 水平（右へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [100, 0.25, 108, -0.25] },
    // 右下コーナー: 垂直（下へ伸びる）
    { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
      geometricBounds: [99.75, 0, 100.25, -8] },
  ];

  it("CENTER-01: センタートンボ（内側エッジがアートボードに接しない）があっても内周を正しく計算する", () => {
    // センタートンボ（上下左右の辺中央、アートボードから離れている）
    // これらの bounds[3]/bounds[1] がアートボード境界を超えると内周計算が歪む
    const centerMarks = [
      // 上辺センター: アートボードから5ptほど離れて外側に置かれている（内側エッジ=105 > artboard.top=100）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [49.75, 115, 50.25, 105] },
      // 下辺センター: 内側エッジ=-5 < artboard.bottom=0
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [49.75, -5, 50.25, -15] },
      // 左辺センター: 内側エッジ=-5 < artboard.left=0（左辺なのでbounds[2]が重要ではないが）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-15, 50.25, -5, 49.75] },
      // 右辺センター: 内側エッジ=105 > artboard.right=100
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [105, 50.25, 115, 49.75] },
    ];

    const allPaths = (cornerPaths as object[]).concat(centerMarks as object[]);

    const mockDoc = {
      layers: [{ name: "トンボ", pageItems: allPaths, layers: [] }],
      artboards: [{ artboardRect: [200, 300, 400, 100] }], // intentionally different from trim mark inner
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // センタートンボを含めた全パスで計算すると歪むが、四隅のみで計算すれば正確
    expect(result.bounds[0]).toBeCloseTo(0, 0);   // innerLeft ≈ 0
    expect(result.bounds[1]).toBeCloseTo(100, 0); // innerTop ≈ 100
    expect(result.bounds[2]).toBeCloseTo(100, 0); // innerRight ≈ 100
    expect(result.bounds[3]).toBeCloseTo(0, 0);   // innerBottom ≈ 0
  });

  it("CENTER-01b: 内周計算結果は 3mm 縮小してアートボード端に合わせる（日本語トンボの内廻しギャップを補正）", () => {
    // Illustrator「トリムマークを作成」はアートボード端から 3mm 離れた位置にトンボを配置する
    // → トンボ内側エッジ = artboard + 3mm → bounds を 3mm 縮小してアートボード端を返す必要がある
    // artboard: [0, 100, 100, 0]、トンボはアートボードから 3mm 外側から始まる
    const BLEED = 8.503937; // 3mm in pt
    const gapPaths = [
      // 左上: 水平（内側エッジ x=−BLEED に接する, つまり artboard.left=0 から 3mm 外）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-8 - BLEED, 100.25, -BLEED, 99.75] },
      // 左上: 垂直（内側エッジ y=100+BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-0.25 - BLEED, 108 + BLEED, 0.25 - BLEED, 100 + BLEED] },
      // 右上: 水平（内側エッジ x=100+BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [100 + BLEED, 100.25, 108 + BLEED, 99.75] },
      // 右上: 垂直（内側エッジ y=100+BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [99.75 + BLEED, 108 + BLEED, 100.25 + BLEED, 100 + BLEED] },
      // 左下: 水平（内側エッジ x=−BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-8 - BLEED, 0.25, -BLEED, -0.25] },
      // 左下: 垂直（内側エッジ y=−BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-0.25 - BLEED, 0 - BLEED, 0.25 - BLEED, -8 - BLEED] },
      // 右下: 水平（内側エッジ x=100+BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [100 + BLEED, 0.25, 108 + BLEED, -0.25] },
      // 右下: 垂直（内側エッジ y=−BLEED）
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [99.75 + BLEED, 0 - BLEED, 100.25 + BLEED, -8 - BLEED] },
    ];

    const mockDoc = {
      layers: [{ name: "トンボ", pageItems: gapPaths, layers: [] }],
      // artboard は [0,100,100,0]（実際のアートボードと一致させる）
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // 3mm ギャップ補正によりアートボード端 [0,100,100,0] に一致するはず
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[1]).toBeCloseTo(100, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
    expect(result.bounds[3]).toBeCloseTo(0, 0);
  });

  it("CENTER-02: コーナーパスが4未満の場合は全パスにフォールバックし、内周計算が無効なら artboard に戻る", () => {
    // 左辺のみの3パス → コーナー識別できず全パスで計算 → innerRight = max(-8,-8,-8) = -8 < innerLeft = 0 → 無効
    const fewPaths = [
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-8, 100.25, 0, 99.75] },
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-0.25, 108, 0.25, 100] },
      { typename: "PathItem", stroked: true, strokeColor: { typename: "RegistrationColor" },
        geometricBounds: [-8, 0.25, 0, -0.25] },
    ];
    const mockDoc = {
      layers: [{ name: "トンボ", pageItems: fewPaths, layers: [] }],
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;
    const result = detectInspectionScope(mockDoc);
    // 内周計算無効 → artboard フォールバック
    expect(result.bounds).toEqual([0, 100, 100, 0]);
  });
});

// レイヤー名によるトンボ優先検出テスト
// Illustrator で作成されるトンボはレジストレーションカラーを使わない場合もあるため、
// "トンボ" / "トリムマーク" / "Trim" 等の名前のレイヤーがあれば優先的に内周を計算する
describe("detectInspectionScope — レイヤー名によるトンボ検出", () => {
  // トンボの内周 = [0, 100, 100, 0]、artboard = [20, 120, 120, 20]（意図的にずらす）
  // レイヤー名検出なし → artboard [20,120,120,20]
  // レイヤー名検出あり → 内周 [0,100,100,0]
  const AB = [20, 120, 120, 20] as const; // artboard（フォールバック用）

  function makeTrimPaths(color: object) {
    // artboard=[0,100,100,0] 相当のトンボ8本
    return [
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [-8, 100.25, 0, 99.75] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [-0.25, 108, 0.25, 100] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [100, 100.25, 108, 99.75] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [99.75, 108, 100.25, 100] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [-8, 0.25, 0, -0.25] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [-0.25, 0, 0.25, -8] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [100, 0.25, 108, -0.25] },
      { typename: "PathItem", stroked: true, strokeColor: color, geometricBounds: [99.75, 0, 100.25, -8] },
    ];
  }
  const cmykBlack = { typename: "CMYKColor", cyan: 0, magenta: 0, yellow: 0, black: 100 };

  it("LAYER-01: レイヤー名「トンボ」で内周を正しく抽出する（レジストレーションカラー不使用）", () => {
    const mockDoc = {
      layers: [
        { name: "トンボ", pageItems: makeTrimPaths(cmykBlack), layers: [] },
        { name: "本体", pageItems: [], layers: [] },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // レイヤー名検出 → 内周 ≈ [0,100,100,0]（artboard [20,120,120,20] ではない）
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[1]).toBeCloseTo(100, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
    expect(result.bounds[3]).toBeCloseTo(0, 0);
  });

  it("LAYER-02: レイヤー名「トリムマーク」でも内周を抽出する", () => {
    const mockDoc = {
      layers: [
        { name: "トリムマーク", pageItems: makeTrimPaths(cmykBlack), layers: [] },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-03: レイヤー名「Trim Marks」（英語）でも内周を抽出する", () => {
    const mockDoc = {
      layers: [
        { name: "Trim Marks", pageItems: makeTrimPaths(cmykBlack), layers: [] },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-04: レイヤー名「tombo」（ローマ字）でも内周を抽出する", () => {
    const mockDoc = {
      layers: [
        { name: "tombo", pageItems: makeTrimPaths(cmykBlack), layers: [] },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-05: 名前なしレイヤーのみ → レジストレーションカラー探索にフォールバック", () => {
    // 通常レイヤー名（"レイヤー 1"）だが RegistrationColor → 従来ロジックで検出
    const mockDoc = {
      layers: [
        {
          name: "レイヤー 1",
          pageItems: makeTrimPaths({ typename: "RegistrationColor" }),
          layers: [],
        },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    // RegistrationColor 探索で内周 ≈ [0,100,100,0] を検出（artboard [20,120,120,20] ではない）
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-07: SpotColor「[Registration]」のトンボ → Step2 で検出する（Illustratorの実際の動作）", () => {
    // Illustrator の「トンボを作成」が生成するパスは SpotColor（spot.name="[Registration]"）を使う
    // 名前なしレイヤーでも Step2 の RegistrationColor 探索で検出されなければならない
    const regSpotColor = { typename: "SpotColor", spot: { name: "[Registration]" } };
    const mockDoc = {
      layers: [
        {
          name: "レイヤー 1",
          pageItems: makeTrimPaths(regSpotColor),
          layers: [],
        },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-08: SpotColor「Registration」（括弧なし）のトンボも検出する", () => {
    const regSpotColor = { typename: "SpotColor", spot: { name: "Registration" } };
    const mockDoc = {
      layers: [
        {
          name: "レイヤー 1",
          pageItems: makeTrimPaths(regSpotColor),
          layers: [],
        },
      ],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-09: stroked が数値 1（boolean ではない）でも検出できる", () => {
    // ExtendScript の Illustrator は stroked を true/false ではなく 1/0 で返すことがある
    const paths = makeTrimPaths(cmykBlack).map(p => ({ ...p, stroked: 1 as unknown as boolean }));
    const mockDoc = {
      layers: [{ name: "トンボ", pageItems: paths, layers: [] }],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;
    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-10: CompoundPathItem のトンボも Step2 で検出できる", () => {
    // Illustrator の一部トンボは CompoundPathItem として作成される
    const compoundPaths = makeTrimPaths({ typename: "RegistrationColor" }).map(p => ({
      ...p,
      typename: "CompoundPathItem",
    }));
    const mockDoc = {
      layers: [{ name: "レイヤー 1", pageItems: compoundPaths, layers: [] }],
      artboards: [{ artboardRect: AB }],
      activeArtboardIndex: 0,
    } as unknown as Document;
    const result = detectInspectionScope(mockDoc);
    expect(result.bounds[0]).toBeCloseTo(0, 0);
    expect(result.bounds[2]).toBeCloseTo(100, 0);
  });

  it("LAYER-06: トンボレイヤーが空 → artboard フォールバック", () => {
    const mockDoc = {
      layers: [
        { name: "トンボ", pageItems: [], layers: [] },
      ],
      artboards: [{ artboardRect: [0, 100, 100, 0] }],
      activeArtboardIndex: 0,
    } as unknown as Document;

    const result = detectInspectionScope(mockDoc);
    expect(result.bounds).toEqual([0, 100, 100, 0]);
  });
});

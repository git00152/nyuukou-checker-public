import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImageItem } from "../../src/jsx/hostscript/checks/checkImageResolution";

// estimateDpi はモジュール内部関数のため、checkImageResolution をインポートして vi.spyOn でモック
// DPI 値注入は checkImageResolution の _dpiMap 引数 (テスト専用の第3引数) を利用する
import { checkImageResolution } from "../../src/jsx/hostscript/checks/checkImageResolution";

// ヘルパー: PlacedItem モックを生成
function makePlacedItem(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    typename: "PlacedItem",
    name: "test-placed.tif",
    file: { fsName: "/path/to/test-placed.tif" },
    matrix: { mValueA: 1, mValueD: 1 },
    geometricBounds: [0, 100, 100, 0],
    ...overrides,
  };
}

// ヘルパー: RasterItem モックを生成
function makeRasterItem(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    typename: "RasterItem",
    name: "test-raster.psd",
    imageColorSpace: "ImageColorSpace.CMYK",
    geometricBounds: [0, 100, 100, 0],
    embedded: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("checkImageResolution — IMG-04: リンク切れ", () => {
  it("Test 1: PlacedItem の file が null → ERROR IMG_LINK_BROKEN_01", () => {
    const item = makePlacedItem({ file: null as unknown as undefined });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_LINK_BROKEN_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/リンク切れ/);
  });

  it("Test 2: PlacedItem の file が undefined → ERROR IMG_LINK_BROKEN_01", () => {
    const item = makePlacedItem({ file: undefined });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_LINK_BROKEN_01");
    expect(errors).toHaveLength(1);
  });

  it("Test 2c: ExtendScript 実挙動: item.file アクセスが例外を投げるオブジェクト → ERROR IMG_LINK_BROKEN_01（例外を投げない）", () => {
    // ExtendScript では PlacedItem.file が存在しない場合、プロパティ参照自体が
    // "There is no file associated with this item" 例外を投げる。
    // この挙動を JS getter で模倣し、checkImageResolution が例外なく
    // IMG_LINK_BROKEN_01 ERROR を返すことを確認する。
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "broken-link.tif",
      get file(): { fsName: string } {
        throw new Error("There is no file associated with this item");
      },
      matrix: { mValueA: 1, mValueD: 1 },
      geometricBounds: [0, 100, 100, 0],
    };
    let results: ReturnType<typeof checkImageResolution>;
    expect(() => {
      results = checkImageResolution([item]);
    }).not.toThrow();
    const errors = results!.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_LINK_BROKEN_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/リンク切れ/);
  });

  it("Test 2b: PlacedItem の file が存在する → リンク切れ ERROR は出ない", () => {
    const item = makePlacedItem({ file: { fsName: "/valid/path.tif" } });
    // DPI 取得不可 INFO は出るが、リンク切れ ERROR は出ない
    const results = checkImageResolution([item]);
    const linkErrors = results.filter((r) => r.messageKey === "IMG_LINK_BROKEN_01");
    expect(linkErrors).toHaveLength(0);
  });
});

describe("checkImageResolution — IMG-05: カラーモード", () => {
  it("Test 3: RasterItem の imageColorSpace が ImageColorSpace.RGB → ERROR IMG_COLOR_SPACE_01", () => {
    const item = makeRasterItem({ imageColorSpace: "ImageColorSpace.RGB" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(1);
  });

  it("Test 4: RasterItem の imageColorSpace が ImageColorSpace.CMYK → ERROR なし", () => {
    const item = makeRasterItem({ imageColorSpace: "ImageColorSpace.CMYK" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  it("Test 5: RasterItem の imageColorSpace が ImageColorSpace.Grayscale → ERROR なし", () => {
    const item = makeRasterItem({ imageColorSpace: "ImageColorSpace.Grayscale" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  // NOTE: ImageColorSpace enum に Bitmap は存在しない。
  // 実際の ExtendScript では Bitmap 画像は別の形で表現されるため、
  // ALLOWED_COLOR_SPACES から削除済み。Bitmap 文字列が来た場合は ERROR とする。
  it("Test 6: RasterItem の imageColorSpace が ImageColorSpace.Bitmap → ERROR IMG_COLOR_SPACE_01", () => {
    const item = makeRasterItem({ imageColorSpace: "ImageColorSpace.Bitmap" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(1);
  });

  // Bug fix tests: PlacedItem (リンク画像) の RGB カラーモード検出
  it("Test 3b: PlacedItem（リンク画像）の imageColorSpace が ImageColorSpace.RGB → ERROR IMG_COLOR_SPACE_01", () => {
    const item = makePlacedItem({ imageColorSpace: "ImageColorSpace.RGB" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/リンク/);
  });

  it("Test 4b: PlacedItem（リンク画像）の imageColorSpace が ImageColorSpace.CMYK → ERROR なし", () => {
    const item = makePlacedItem({ imageColorSpace: "ImageColorSpace.CMYK" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  it("Test 5b: PlacedItem（リンク画像）の imageColorSpace が undefined → カラーモード ERROR なし", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  // Bug 1a: GrayScale 大文字S のテスト（現在は小文字sしか許可しておらずERRORが出るバグ）
  it("Test 4c: RasterItem の imageColorSpace が ImageColorSpace.GrayScale（大文字S）→ ERROR なし", () => {
    const item = makeRasterItem({ imageColorSpace: "ImageColorSpace.GrayScale" });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  // Bug 1b: PlacedItem にカラーモード手動確認INFOが表示されること
  it("Test 3c: PlacedItem（リンク画像）の imageColorSpace が取得できない場合 → INFO IMG_COLOR_SPACE_MANUAL_01", () => {
    // PlacedItem は ExtendScript API 上 imageColorSpace を持たないため undefined
    const item = makePlacedItem({ imageColorSpace: undefined });
    const results = checkImageResolution([item]);
    const infos = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01");
    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe("INFO");
    expect(infos[0].message).toMatch(/リンク|確認/);
  });
});

describe("checkImageResolution — PNG ヘッダ判定への受け渡し", () => {
  it("PNG は reader 未指定なら手動確認", () => {
    const results = checkImageResolution([makePlacedItem({ file: { fsName: "/gray.png" } })]);
    expect(results.some(r => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01")).toBe(true);
    expect(results.some(r => r.messageKey === "IMG_COLOR_SPACE_01")).toBe(false);
  });

  it.each(["Grayscale", "Bitmap", "RGB"])("PNG の %s 判定を使用する", (mode) => {
    const reader = vi.fn(() => mode);
    const results = checkImageResolution([makePlacedItem({ file: { fsName: "/image.PNG" } })], {}, undefined, reader);
    expect(reader).toHaveBeenCalledWith("/image.PNG");
    expect(results.some(r => r.messageKey === "IMG_COLOR_SPACE_01")).toBe(mode === "RGB");
  });

  it("EXT-3: fsName が .jpg の PlacedItem → _colorReader なしなら INFO（ファイル読み取りが必要）", () => {
    const item = makePlacedItem({
      imageColorSpace: undefined,
      file: { fsName: "/path/to/photo.jpg" },
    });
    const results = checkImageResolution([item]); // _colorReader 未指定
    // JPG は拡張子だけでは判断できないため INFO になる
    const infos = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01");
    expect(infos).toHaveLength(1);
  });

  it("EXT-4: fsName が .psd の PlacedItem → _colorReader が CMYK を返す → ERROR なし", () => {
    const item = makePlacedItem({
      imageColorSpace: undefined,
      file: { fsName: "/path/to/artwork.psd" },
    });
    const reader = (_fsName: string) => "CMYK";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  it("EXT-5: fsName が .psb の PlacedItem → _colorReader が RGB を返す → ERROR IMG_COLOR_SPACE_01", () => {
    const item = makePlacedItem({
      imageColorSpace: undefined,
      file: { fsName: "/path/to/large.psb" },
    });
    const reader = (_fsName: string) => "RGB";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(1);
  });
});

describe("checkImageResolution — Bug1: _colorReader 注入によるリンク画像カラーモード検出", () => {
  it("CR-1: _colorReader が 'RGB' を返す → ERROR IMG_COLOR_SPACE_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const reader = (_fsName: string) => "RGB";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/RGB/);
  });

  it("CR-2: _colorReader が 'CMYK' を返す → IMG_COLOR_SPACE_01 ERROR なし", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const reader = (_fsName: string) => "CMYK";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  it("CR-3: _colorReader が 'Grayscale' を返す → IMG_COLOR_SPACE_01 ERROR なし", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const reader = (_fsName: string) => "Grayscale";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  it("CR-4: _colorReader が 'Bitmap' を返す → IMG_COLOR_SPACE_01 ERROR なし（1bit mono は許可）", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const reader = (_fsName: string) => "Bitmap";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(0);
  });

  it("CR-5: _colorReader が 'Indexed' を返す → ERROR IMG_COLOR_SPACE_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const reader = (_fsName: string) => "Indexed";
    const results = checkImageResolution([item], {}, undefined, reader);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_COLOR_SPACE_01");
    expect(errors).toHaveLength(1);
  });

  it("CR-6: _colorReader が null を返す (読み取り失敗) → INFO IMG_COLOR_SPACE_MANUAL_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const reader = (_fsName: string) => null;
    const results = checkImageResolution([item], {}, undefined, reader);
    const infos = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01");
    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe("INFO");
  });

  it("CR-7: _colorReader 未指定 (undefined) → 既存動作: INFO IMG_COLOR_SPACE_MANUAL_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined });
    const results = checkImageResolution([item]);
    const infos = results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01");
    expect(infos).toHaveLength(1);
  });

  it("CR-8: _colorReader の第一引数に fsName が渡される (非PNG)", () => {
    // ファイルパスをヘッダ判定へ渡す。
    const item = makePlacedItem({
      imageColorSpace: undefined,
      file: { fsName: "/actual/path/image.jpg" },
    });
    const receivedPaths: string[] = [];
    const reader = (fsName: string) => { receivedPaths.push(fsName); return "CMYK"; };
    checkImageResolution([item], {}, undefined, reader);
    expect(receivedPaths).toContain("/actual/path/image.jpg");
  });
});

describe("checkImageResolution — バグ修正: 空のファイル名表示", () => {
  it("Test 13: item.name が空文字列のとき、メッセージに空名称が表示されず fsName から取得する", () => {
    // matrix なし → UNKNOWN になる（名称表示のテストに専念するため）
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "",
      file: { fsName: "/path/to/image.tif" },
      geometricBounds: [0, 100, 100, 0],
    };
    const results = checkImageResolution([item]);
    const infos = results.filter((r) => r.messageKey === "IMG_RESOLUTION_UNKNOWN_01");
    expect(infos).toHaveLength(1);
    // メッセージが " (リンク)" で始まる空名称パターンになっていないこと
    expect(infos[0].message).not.toMatch(/: " \(リンク\)"/);
    // fsName のベース名またはフォールバック名が含まれること
    expect(infos[0].message).toMatch(/image\.tif|image/);
  });

  it("Windows形式の fsName からもベース名を取得する", () => {
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "",
      file: { fsName: "C:\\path\\to\\image.tif" },
      geometricBounds: [0, 100, 100, 0],
    };

    const results = checkImageResolution([item]);
    const info = results.find((result) => result.messageKey === "IMG_RESOLUTION_UNKNOWN_01");
    expect(info?.message).toContain('"image.tif (リンク)"');
  });

  it("Test 14: item.name が空文字列かつ file も undefined のとき、(不明) フォールバックが表示される", () => {
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "",
      file: undefined,
      matrix: { mValueA: 1, mValueD: 1 },
      geometricBounds: [0, 100, 100, 0],
    };
    // file が undefined の場合はリンク切れ ERROR が出る（IMG-04）ので INFO は出ない
    const results = checkImageResolution([item]);
    const linkErrors = results.filter((r) => r.messageKey === "IMG_LINK_BROKEN_01");
    expect(linkErrors).toHaveLength(1);
    // リンク切れメッセージでも空の " (リンク)" パターンにならないこと
    expect(linkErrors[0].message).not.toMatch(/: " \(リンク\)"/);
  });
});

describe("checkImageResolution — PlacedItem matrix から DPI 算出", () => {
  it("Test P1: 400 DPI のリンク画像 (mValueA=72/400=0.18) → DPI 警告なし", () => {
    const item = makePlacedItem({ matrix: { mValueA: 72 / 400, mValueD: 72 / 400 } });
    const results = checkImageResolution([item]);
    const dpiIssues = results.filter(
      (r) =>
        r.messageKey === "IMG_RESOLUTION_LOW_01" ||
        r.messageKey === "IMG_RESOLUTION_WARN_01" ||
        r.messageKey === "IMG_RESOLUTION_UNKNOWN_01"
    );
    expect(dpiIssues).toHaveLength(0);
  });

  it("Test P2: 150 DPI のリンク画像 (mValueA=72/150=0.48) → ERROR IMG_RESOLUTION_LOW_01", () => {
    const item = makePlacedItem({ matrix: { mValueA: 72 / 150, mValueD: 72 / 150 } });
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/150/);
  });

  it("Test P3: 320 DPI のリンク画像 (mValueA=72/320≈0.225) → WARNING IMG_RESOLUTION_WARN_01", () => {
    const item = makePlacedItem({ matrix: { mValueA: 72 / 320, mValueD: 72 / 320 } });
    const results = checkImageResolution([item]);
    const warnings = results.filter((r) => r.severity === "WARNING" && r.messageKey === "IMG_RESOLUTION_WARN_01");
    expect(warnings).toHaveLength(1);
  });

  it("Test P5: 400 DPI の画像が 90° 回転（mValueA=0, mValueC=-0.18, mValueB=0.18, mValueD=0）→ DPI 警告なし", () => {
    const s = 72 / 400; // 0.18
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "rotated-400dpi.tif",
      file: { fsName: "/path/to/rotated-400dpi.tif" },
      matrix: { mValueA: 0, mValueB: s, mValueC: -s, mValueD: 0 },
      geometricBounds: [0, 100, 100, 0],
    };
    const results = checkImageResolution([item]);
    const dpiIssues = results.filter(
      (r) =>
        r.messageKey === "IMG_RESOLUTION_LOW_01" ||
        r.messageKey === "IMG_RESOLUTION_WARN_01" ||
        r.messageKey === "IMG_RESOLUTION_UNKNOWN_01"
    );
    expect(dpiIssues).toHaveLength(0);
  });

  it("Test P6: 150 DPI の画像が 45° 回転（複合行列）→ ERROR IMG_RESOLUTION_LOW_01", () => {
    const s = 72 / 150; // 0.48
    const cos45 = Math.cos(Math.PI / 4); // ≈ 0.707
    const sin45 = Math.sin(Math.PI / 4); // ≈ 0.707
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "rotated-150dpi.tif",
      file: { fsName: "/path/to/rotated-150dpi.tif" },
      matrix: {
        mValueA: s * cos45,
        mValueB: s * sin45,
        mValueC: -s * sin45,
        mValueD: s * cos45,
      },
      geometricBounds: [0, 100, 100, 0],
    };
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
  });

  it("Test P4: matrix がない PlacedItem → INFO IMG_RESOLUTION_UNKNOWN_01", () => {
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "no-matrix.tif",
      file: { fsName: "/path/to/no-matrix.tif" },
      geometricBounds: [0, 100, 100, 0],
    };
    const results = checkImageResolution([item]);
    const infos = results.filter((r) => r.messageKey === "IMG_RESOLUTION_UNKNOWN_01");
    expect(infos).toHaveLength(1);
    expect(infos[0].message).toMatch(/解像度の取得ができませんでした/);
  });
});

describe("checkImageResolution — RasterItem resolution から DPI 算出", () => {
  it("Test R1: 350 DPI の埋め込み画像 ({horizontal,vertical} 形式) → DPI 警告なし", () => {
    const item: ImageItem = { ...makeRasterItem(), resolution: { horizontal: 350, vertical: 350 } };
    const results = checkImageResolution([item]);
    const dpiIssues = results.filter(
      (r) =>
        r.messageKey === "IMG_RESOLUTION_LOW_01" ||
        r.messageKey === "IMG_RESOLUTION_WARN_01" ||
        r.messageKey === "IMG_RESOLUTION_UNKNOWN_01"
    );
    expect(dpiIssues).toHaveLength(0);
  });

  it("Test R2: 150 DPI の埋め込み画像 ({horizontal,vertical} 形式) → ERROR IMG_RESOLUTION_LOW_01", () => {
    const item: ImageItem = { ...makeRasterItem(), resolution: { horizontal: 150, vertical: 150 } };
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/150/);
  });

  it("Test R3: resolution も matrix もない RasterItem → INFO IMG_RESOLUTION_UNKNOWN_01", () => {
    const item = makeRasterItem(); // resolution も matrix もなし
    const results = checkImageResolution([item]);
    const infos = results.filter((r) => r.messageKey === "IMG_RESOLUTION_UNKNOWN_01");
    expect(infos).toHaveLength(1);
  });

  // Illustrator の ExtendScript API では RasterItem に resolution がない場合、
  // PlacedItem と同様に matrix から実効 DPI を算出できる
  it("Test R6: 400 DPI 相当の matrix を持つ RasterItem (resolution なし) → DPI 警告なし", () => {
    const item: ImageItem = {
      ...makeRasterItem(),
      matrix: { mValueA: 72 / 400, mValueD: 72 / 400 },
    };
    const results = checkImageResolution([item]);
    const dpiIssues = results.filter(
      (r) =>
        r.messageKey === "IMG_RESOLUTION_LOW_01" ||
        r.messageKey === "IMG_RESOLUTION_WARN_01" ||
        r.messageKey === "IMG_RESOLUTION_UNKNOWN_01"
    );
    expect(dpiIssues).toHaveLength(0);
  });

  it("Test R7: 150 DPI 相当の matrix を持つ RasterItem (resolution なし) → ERROR IMG_RESOLUTION_LOW_01", () => {
    const item: ImageItem = {
      ...makeRasterItem(),
      matrix: { mValueA: 72 / 150, mValueD: 72 / 150 },
    };
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/150/);
  });

  // resolution が提供される場合の単一数値 (DPI) も受け付ける
  it("Test R4: 350 DPI の埋め込み画像 (number 形式 = Illustrator API 実態) → DPI 警告なし", () => {
    const item: ImageItem = { ...makeRasterItem(), resolution: 350 as unknown as { horizontal: number; vertical: number } };
    const results = checkImageResolution([item]);
    const dpiIssues = results.filter(
      (r) =>
        r.messageKey === "IMG_RESOLUTION_LOW_01" ||
        r.messageKey === "IMG_RESOLUTION_WARN_01" ||
        r.messageKey === "IMG_RESOLUTION_UNKNOWN_01"
    );
    expect(dpiIssues).toHaveLength(0);
  });

  it("Test R5: 150 DPI の埋め込み画像 (number 形式 = Illustrator API 実態) → ERROR IMG_RESOLUTION_LOW_01", () => {
    const item: ImageItem = { ...makeRasterItem(), resolution: 150 as unknown as { horizontal: number; vertical: number } };
    const results = checkImageResolution([item]);
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/150/);
  });
});

describe("checkImageResolution — bounds オーバーレイ出力", () => {
  it("BOUNDS-1: リンク切れ ERROR は bounds を含む", () => {
    const item = makePlacedItem({ file: null as unknown as undefined, geometricBounds: [10, 200, 110, 100] });
    const results = checkImageResolution([item]);
    const err = results.find((r) => r.messageKey === "IMG_LINK_BROKEN_01");
    expect(err).toBeDefined();
    expect(err!.bounds).toEqual([10, 200, 110, 100]);
    expect(err!.targetRef).toMatchObject({
      kind: "placedItem",
      messageKey: "IMG_LINK_BROKEN_01",
      collectionIndex: 0,
    });
  });

  it("BOUNDS-2: カラーモード ERROR は bounds を含む", () => {
    const item = makeRasterItem({ imageColorSpace: "ImageColorSpace.RGB", geometricBounds: [20, 300, 120, 200] });
    const results = checkImageResolution([item]);
    const err = results.find((r) => r.messageKey === "IMG_COLOR_SPACE_01");
    expect(err).toBeDefined();
    expect(err!.bounds).toEqual([20, 300, 120, 200]);
    expect(err!.targetRef).toMatchObject({
      kind: "rasterItem",
      messageKey: "IMG_COLOR_SPACE_01",
      collectionIndex: 0,
    });
  });

  it("BOUNDS-3: 解像度 ERROR は bounds を含む", () => {
    const item = makePlacedItem({ name: "low.tif", geometricBounds: [0, 50, 50, 0] });
    const results = checkImageResolution([item], {}, { "low.tif": 150 });
    const err = results.find((r) => r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(err).toBeDefined();
    expect(err!.bounds).toEqual([0, 50, 50, 0]);
  });

  it("BOUNDS-4: 解像度 WARNING は bounds を含む", () => {
    const item = makePlacedItem({ name: "mid.tif", geometricBounds: [5, 60, 55, 5] });
    const results = checkImageResolution([item], {}, { "mid.tif": 320 });
    const warn = results.find((r) => r.messageKey === "IMG_RESOLUTION_WARN_01");
    expect(warn).toBeDefined();
    expect(warn!.bounds).toEqual([5, 60, 55, 5]);
  });
});

describe("checkImageResolution — IMG-01/02/03: DPI チェック（dpiOverride で注入）", () => {
  it("Test 7: matrix なしかつ dpiOverride 未指定 → INFO IMG_RESOLUTION_UNKNOWN_01", () => {
    const item: ImageItem = {
      typename: "PlacedItem",
      name: "no-matrix.tif",
      file: { fsName: "/path/to/no-matrix.tif" },
      geometricBounds: [0, 100, 100, 0],
    };
    const results = checkImageResolution([item]);
    const infos = results.filter((r) => r.severity === "INFO" && r.messageKey === "IMG_RESOLUTION_UNKNOWN_01");
    expect(infos).toHaveLength(1);
    expect(infos[0].message).toMatch(/解像度の取得ができませんでした/);
  });

  it("Test 8: largePrintMode=false, DPI=280 → ERROR IMG_RESOLUTION_LOW_01", () => {
    const item = makePlacedItem({ name: "low-res.tif" });
    const results = checkImageResolution([item], { largePrintMode: false }, { "low-res.tif": 280 });
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
  });

  it("Test 9: largePrintMode=false, DPI=320 → WARNING IMG_RESOLUTION_WARN_01", () => {
    const item = makePlacedItem({ name: "mid-res.tif" });
    const results = checkImageResolution([item], { largePrintMode: false }, { "mid-res.tif": 320 });
    const warnings = results.filter((r) => r.severity === "WARNING" && r.messageKey === "IMG_RESOLUTION_WARN_01");
    expect(warnings).toHaveLength(1);
  });

  it("Test 10: largePrintMode=false, DPI=360 → 警告なし（OK）", () => {
    const item = makePlacedItem({ name: "ok-res.tif" });
    const results = checkImageResolution([item], { largePrintMode: false }, { "ok-res.tif": 360 });
    const dpiIssues = results.filter(
      (r) => r.messageKey === "IMG_RESOLUTION_LOW_01" || r.messageKey === "IMG_RESOLUTION_WARN_01"
    );
    expect(dpiIssues).toHaveLength(0);
  });

  it("Test 11: largePrintMode=true, DPI=210 → INFO IMG_RESOLUTION_LARGE_PRINT_01（200dpi 以上の大判モード緩和）", () => {
    const item = makePlacedItem({ name: "large-ok.tif" });
    const results = checkImageResolution([item], { largePrintMode: true }, { "large-ok.tif": 210 });
    const infos = results.filter((r) => r.severity === "INFO" && r.messageKey === "IMG_RESOLUTION_LARGE_PRINT_01");
    expect(infos).toHaveLength(1);
  });

  it("Test 12: largePrintMode=true, DPI=190 → ERROR（200dpi 未満は大判モードでも ERROR）", () => {
    const item = makePlacedItem({ name: "large-low.tif" });
    const results = checkImageResolution([item], { largePrintMode: true }, { "large-low.tif": 190 });
    const errors = results.filter((r) => r.severity === "ERROR" && r.messageKey === "IMG_RESOLUTION_LOW_01");
    expect(errors).toHaveLength(1);
  });
});


describe("画像判定の回帰", () => {
  it("File オブジェクトがあっても exists=false ならリンク切れ", () => {
    const reader = vi.fn();
    const results = checkImageResolution([makePlacedItem({ file: { fsName: "/missing.tif", exists: false } })], {}, undefined, reader);
    expect(results.map(r => r.messageKey)).toEqual(["IMG_LINK_BROKEN_01"]);
    expect(reader).not.toHaveBeenCalled();
  });
  it("同じリンクは検査ごとに一度だけ読み、次回には再取得する", () => {
    const reader = vi.fn(() => "CMYK");
    const items = [makePlacedItem(), makePlacedItem({ name: "copy" })];
    checkImageResolution(items, {}, undefined, reader);
    expect(reader).toHaveBeenCalledTimes(1);
    checkImageResolution(items, {}, undefined, reader);
    expect(reader).toHaveBeenCalledTimes(2);
  });
  it("1つのファイルが読めなくても次の画像を検査する", () => {
    const reader = vi.fn().mockImplementationOnce(() => { throw new Error("read failed"); }).mockReturnValue("RGB");
    const results = checkImageResolution([makePlacedItem(), makePlacedItem({ file: { fsName: "/next.png" } })], {}, undefined, reader);
    expect(results.some(r => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01")).toBe(true);
    expect(results.some(r => r.messageKey === "IMG_COLOR_SPACE_01")).toBe(true);
  });
  it.each([199.99, 299.99, 349.99])("%s dpi を丸めて閾値を超えさせない", (dpi) => {
    const item = makePlacedItem({ matrix: { mValueA: 72 / dpi, mValueD: 72 / dpi } });
    const results = checkImageResolution([item], { largePrintMode: dpi < 200 });
    expect(results.find(r => /IMG_RESOLUTION_(LOW|WARN)_01/.test(r.messageKey))?.severity).toBe(dpi < 300 ? "ERROR" : "WARNING");
  });
  it("不均等に拡縮して45度回転した画像は低い方の解像度で判定する", () => {
    const c = Math.SQRT1_2;
    const item = makePlacedItem({ matrix: { mValueA: 0.3*c, mValueB: 0.3*c, mValueC: -0.1*c, mValueD: 0.1*c } });
    expect(checkImageResolution([item]).some(r => r.messageKey === "IMG_RESOLUTION_LOW_01")).toBe(true);
  });
  it.each([NaN, Infinity, 0, -1])("無効な解像度 %s を合格にしない", (resolution) => {
    expect(checkImageResolution([makeRasterItem({ resolution })]).some(r => r.messageKey === "IMG_RESOLUTION_UNKNOWN_01")).toBe(true);
  });
});


it.each(["ai", "pdf", "eps", "svg"])("ベクターを含む配置%sは行列だけで低解像度にしない", (extension) => {
  const results = checkImageResolution([makePlacedItem({ file: { fsName: "/linked." + extension } })]);
  expect(results.some(r => r.messageKey === "IMG_RESOLUTION_LOW_01")).toBe(false);
  expect(results.some(r => r.messageKey === "IMG_RESOLUTION_UNKNOWN_01")).toBe(true);
});

it("300dpi を回転した際の浮動小数点誤差で ERROR にしない", () => {
  const s = 72 / 300 * Math.SQRT1_2;
  const results = checkImageResolution([makePlacedItem({ matrix: { mValueA: s, mValueB: s, mValueC: -s, mValueD: s } })]);
  expect(results.some(r => r.messageKey === "IMG_RESOLUTION_LOW_01")).toBe(false);
  expect(results.some(r => r.messageKey === "IMG_RESOLUTION_WARN_01")).toBe(true);
});

describe("checkImageResolution — RGB 入稿プロファイル: カラーモード", () => {
  const rgb = { colorWorkflow: "rgb" as const };
  const colorKeys = ["IMG_COLOR_SPACE_01", "IMG_COLOR_SPACE_RGB_01", "IMG_COLOR_SPACE_CMYK_IN_RGB_01"];
  const colorResults = (results: ReturnType<typeof checkImageResolution>) =>
    results.filter((r) => colorKeys.indexOf(r.messageKey) !== -1);

  it("RGB-1: RasterItem が RGB → カラーモードの指摘なし", () => {
    const results = checkImageResolution([makeRasterItem({ imageColorSpace: "ImageColorSpace.RGB" })], rgb);
    expect(colorResults(results)).toHaveLength(0);
  });

  it("RGB-2: RasterItem が Grayscale → カラーモードの指摘なし", () => {
    const results = checkImageResolution([makeRasterItem({ imageColorSpace: "ImageColorSpace.Grayscale" })], rgb);
    expect(colorResults(results)).toHaveLength(0);
  });

  it("RGB-3: RasterItem が CMYK → WARNING IMG_COLOR_SPACE_CMYK_IN_RGB_01", () => {
    const results = checkImageResolution([makeRasterItem({ imageColorSpace: "ImageColorSpace.CMYK" })], rgb);
    const found = colorResults(results);
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("WARNING");
    expect(found[0].messageKey).toBe("IMG_COLOR_SPACE_CMYK_IN_RGB_01");
    expect(found[0].targetRef).toBeDefined();
  });

  it("RGB-4: RasterItem が Indexed → ERROR IMG_COLOR_SPACE_RGB_01", () => {
    const results = checkImageResolution([makeRasterItem({ imageColorSpace: "ImageColorSpace.Indexed" })], rgb);
    const found = colorResults(results);
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("ERROR");
    expect(found[0].messageKey).toBe("IMG_COLOR_SPACE_RGB_01");
  });

  it("RGB-5: PNG リンク画像 → カラーモードの指摘なし", () => {
    const item = makePlacedItem({ imageColorSpace: undefined, file: { fsName: "/path/to/image.png" } });
    expect(colorResults(checkImageResolution([item], rgb))).toHaveLength(0);
  });

  it("RGB-6: _colorReader が RGB / Grayscale / Bitmap を返す → カラーモードの指摘なし", () => {
    for (const mode of ["RGB", "Grayscale", "Bitmap"]) {
      const item = makePlacedItem({ imageColorSpace: undefined, file: { fsName: "/path/to/a.psd" } });
      expect(colorResults(checkImageResolution([item], rgb, undefined, () => mode))).toHaveLength(0);
    }
  });

  it("RGB-7: _colorReader が CMYK を返す → WARNING IMG_COLOR_SPACE_CMYK_IN_RGB_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined, file: { fsName: "/path/to/a.tif" } });
    const found = colorResults(checkImageResolution([item], rgb, undefined, () => "CMYK"));
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("WARNING");
    expect(found[0].messageKey).toBe("IMG_COLOR_SPACE_CMYK_IN_RGB_01");
  });

  it("RGB-8: _colorReader が Lab を返す → ERROR IMG_COLOR_SPACE_RGB_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined, file: { fsName: "/path/to/a.psd" } });
    const found = colorResults(checkImageResolution([item], rgb, undefined, () => "Lab"));
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("ERROR");
    expect(found[0].messageKey).toBe("IMG_COLOR_SPACE_RGB_01");
  });

  it("RGB-9: 判定できないリンク画像は従来どおり INFO IMG_COLOR_SPACE_MANUAL_01", () => {
    const item = makePlacedItem({ imageColorSpace: undefined, file: { fsName: "/path/to/a.jpg" } });
    const results = checkImageResolution([item], rgb, undefined, () => null);
    expect(results.filter((r) => r.messageKey === "IMG_COLOR_SPACE_MANUAL_01")).toHaveLength(1);
  });

  it("RGB-10: 解像度判定はプロファイルに関係なく同じ", () => {
    const results = checkImageResolution([makeRasterItem({ imageColorSpace: "ImageColorSpace.RGB", name: "low" })], rgb, { low: 280 });
    expect(results.filter((r) => r.messageKey === "IMG_RESOLUTION_LOW_01")).toHaveLength(1);
  });
});

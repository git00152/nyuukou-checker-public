import { ScopeInfo } from "../types";

interface ColorLike {
  typename: string;
  cyan?: number;
  magenta?: number;
  yellow?: number;
  black?: number;
  spot?: { name?: string };
}

interface PathItemLike {
  typename: string;
  stroked: boolean;
  strokeColor: ColorLike;
  geometricBounds: [number, number, number, number];
}

interface GroupItemLike {
  typename: string;
  pageItems: PageItemOrGroupLike[];
}

type PageItemOrGroupLike = PathItemLike | GroupItemLike;

interface LayerLike {
  name?: string;
  pageItems: PageItemOrGroupLike[];
  layers: LayerLike[];
}

interface ArtboardsLike {
  [index: number]: { artboardRect: [number, number, number, number] };
  length: number;
  getActiveArtboardIndex?: () => number;
}

interface DocumentLike {
  layers: LayerLike[];
  artboards: ArtboardsLike;
}

// トンボレイヤーと判定するキーワード
// 日本語文字列を String.fromCharCode() で構築することで、ファイルエンコーディングに依存しない
// （Illustrator が JSファイルを Shift-JIS で読む場合にも正しく比較できる）
const _TOMBO       = String.fromCharCode(0x30C8, 0x30F3, 0x30DC);               // トンボ
const _TRIM_MARK   = String.fromCharCode(0x30C8, 0x30EA, 0x30E0, 0x30DE, 0x30FC, 0x30AF); // トリムマーク
const TRIM_LAYER_KEYWORDS = [_TOMBO, _TRIM_MARK, "trim", "tombo", "crop mark", "cropmark"];

export function isTrimMarkLayerName(name: string): boolean {
  // ExtendScript 互換: toLowerCase() は ES3 でも動作する
  const lower = name.toLowerCase();
  for (let i = 0; i < TRIM_LAYER_KEYWORDS.length; i++) {
    // indexOf は ES3 互換（includes は使用不可）
    if (lower.indexOf(TRIM_LAYER_KEYWORDS[i]) !== -1) return true;
  }
  return false;
}

function isRegistrationColor(color: ColorLike): boolean {
  if (color.typename === "RegistrationColor") {
    return true;
  }
  if (
    color.typename === "CMYKColor" &&
    color.cyan === 100 &&
    color.magenta === 100 &&
    color.yellow === 100 &&
    color.black === 100
  ) {
    return true;
  }
  // Illustrator の「トンボを作成」は SpotColor（spot.name="[Registration]"）を生成する
  if (color.typename === "SpotColor" && color.spot) {
    const spotName = color.spot.name || "";
    if (spotName === "Registration" || spotName === "[Registration]") return true;
  }
  return false;
}

/** 色フィルターあり: RegistrationColor / CMYK-100 ストロークのみ収集 */
function collectTrimMarkPathsFromItems(
  pageItems: PageItemOrGroupLike[],
  result: PathItemLike[]
): void {
  // ExtendScript 互換: Illustrator のネイティブコレクションは Symbol.iterator を持たないため
  // for...of ではなく for(var i) インデックスループを使用する
  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
      const path = item as PathItemLike;
      // ExtendScript の Illustrator では stroked が 1/0（数値）を返すことがあるため truthy チェック
      if (path.stroked && isRegistrationColor(path.strokeColor)) {
        result.push(path);
      }
    } else if (item.typename === "GroupItem") {
      // GroupItem の中にあるトンボも再帰的に収集する
      const group = item as GroupItemLike;
      if (group.pageItems) {
        collectTrimMarkPathsFromItems(group.pageItems, result);
      }
    }
  }
}

/** 色フィルターなし: トンボ専用レイヤー内の全ストロークパスを収集 */
function collectAllStrokedPathsFromItems(
  pageItems: PageItemOrGroupLike[],
  result: PathItemLike[]
): void {
  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
      const path = item as PathItemLike;
      // ExtendScript の Illustrator では stroked が 1/0（数値）を返すことがあるため truthy チェック
      if (path.stroked) {
        result.push(path);
      }
    } else if (item.typename === "GroupItem") {
      const group = item as GroupItemLike;
      if (group.pageItems) {
        collectAllStrokedPathsFromItems(group.pageItems, result);
      }
    }
  }
}

function collectTrimMarkPaths(
  layer: LayerLike,
  result: PathItemLike[]
): void {
  collectTrimMarkPathsFromItems(layer.pageItems, result);
  const sublayers = layer.layers;
  for (let j = 0; j < sublayers.length; j++) {
    collectTrimMarkPaths(sublayers[j], result);
  }
}

function collectAllStrokedPathsFromLayer(
  layer: LayerLike,
  result: PathItemLike[]
): void {
  collectAllStrokedPathsFromItems(layer.pageItems, result);
  const sublayers = layer.layers;
  for (let j = 0; j < sublayers.length; j++) {
    collectAllStrokedPathsFromLayer(sublayers[j], result);
  }
}

/**
 * 全パスから四隅のパスのみを抽出する（センタートンボ・丸トンボを除外）
 * アルゴリズム:
 *   1. 全パスの外周ボックスの重心 (cx, cy) を計算
 *   2. 各パスの重心が X・Y ともに外周の 25% 以上外側にあるものを「コーナーパス」とする
 *   3. コーナーパスが 4 未満の場合は全パスにフォールバック（計算できないより良い）
 */
function filterToCornerPaths(paths: PathItemLike[]): PathItemLike[] {
  if (paths.length < 4) return paths;

  // 全パスの外周ボックスを求める
  let minX = paths[0].geometricBounds[0];
  let maxX = paths[0].geometricBounds[2];
  let minY = paths[0].geometricBounds[3];
  let maxY = paths[0].geometricBounds[1];

  for (let i = 1; i < paths.length; i++) {
    const gb = paths[i].geometricBounds;
    if (gb[0] < minX) minX = gb[0];
    if (gb[2] > maxX) maxX = gb[2];
    if (gb[3] < minY) minY = gb[3];
    if (gb[1] > maxY) maxY = gb[1];
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w  = maxX - minX;
  const h  = maxY - minY;

  if (w === 0 || h === 0) return paths;

  // 重心から 25% 超外れているパスをコーナーパスとみなす
  const xThresh = w * 0.25;
  const yThresh = h * 0.25;

  const corners: PathItemLike[] = [];
  for (let i = 0; i < paths.length; i++) {
    const gb = paths[i].geometricBounds;
    const pcx = (gb[0] + gb[2]) / 2;
    const pcy = (gb[1] + gb[3]) / 2;
    // X・Y ともに外側でなければコーナーではない
    const extremeX = (pcx - cx) < -xThresh || (pcx - cx) > xThresh;
    const extremeY = (pcy - cy) < -yThresh || (pcy - cy) > yThresh;
    if (extremeX && extremeY) {
      corners.push(paths[i]);
    }
  }

  // コーナーパスが 4 未満の場合は全パスにフォールバック
  return corners.length >= 4 ? corners : paths;
}

/** innerBounds を計算して有効なら返す、無効なら null */
function calcInnerBounds(
  paths: PathItemLike[]
): [number, number, number, number] | null {
  if (paths.length === 0) return null;

  let innerLeft   = paths[0].geometricBounds[2];
  let innerTop    = paths[0].geometricBounds[3];
  let innerRight  = paths[0].geometricBounds[0];
  let innerBottom = paths[0].geometricBounds[1];

  for (let i = 1; i < paths.length; i++) {
    const gb = paths[i].geometricBounds;
    if (gb[2] < innerLeft)   innerLeft   = gb[2];
    if (gb[3] > innerTop)    innerTop    = gb[3];
    if (gb[0] > innerRight)  innerRight  = gb[0];
    if (gb[1] < innerBottom) innerBottom = gb[1];
  }

  if (innerLeft < innerRight && innerTop > innerBottom) {
    return [innerLeft, innerTop, innerRight, innerBottom];
  }
  return null;
}

// Illustrator「トリムマークを作成」の標準ギャップ: 9pt (= 1/8インチ = 3.175mm)
// ※ 3mm (8.504pt) とは異なる。Illustratorが内部的にインチ系単位で配置するため。
const TRIM_MARK_GAP_PT = 9;
// ±3pt の許容幅: 6pt〜12pt (2.1mm〜4.2mm) のギャップを標準とみなす
const TRIM_MARK_GAP_TOL = 3;

/**
 * 検出した内周を Illustrator の標準トンボギャップで補正して印刷面矩形を返す。
 *
 * Case 3: アートボードが検出内周より大幅に大きい（A4 上のラベル等）
 *         → アートボードは印刷面を表さない。検出内周から TRIM_MARK_GAP_PT を引いて印刷面を返す。
 *
 * Case 2: アートボードが検出内周のほぼ TRIM_MARK_GAP_PT 内側（アートボード = 印刷面）
 *         → アートボード矩形をそのまま返す。
 *
 * Case 1: ギャップなし（マークがアートボード端に接している等）
 *         → detected をそのまま返す。
 */
function adjustForTrimMarkGap(
  detected: [number, number, number, number],
  artboardRect: [number, number, number, number]
): [number, number, number, number] {
  const lo = TRIM_MARK_GAP_PT - TRIM_MARK_GAP_TOL; // 6pt
  const hi = TRIM_MARK_GAP_PT + TRIM_MARK_GAP_TOL; // 12pt
  // Case 3: アートボードが検出内周を各辺 (2×TRIM_MARK_GAP_PT + TOL) 以上超えて包含する
  const largeMargin = 2 * TRIM_MARK_GAP_PT + TRIM_MARK_GAP_TOL; // 21pt
  if (artboardRect[0] < detected[0] - largeMargin &&
      artboardRect[1] > detected[1] + largeMargin &&
      artboardRect[2] > detected[2] + largeMargin &&
      artboardRect[3] < detected[3] - largeMargin) {
    return [
      detected[0] + TRIM_MARK_GAP_PT,
      detected[1] - TRIM_MARK_GAP_PT,
      detected[2] - TRIM_MARK_GAP_PT,
      detected[3] + TRIM_MARK_GAP_PT,
    ];
  }
  // Case 2: アートボードが検出内周のほぼ TRIM_MARK_GAP_PT 内側
  const gapLeft   = artboardRect[0] - detected[0];
  const gapTop    = detected[1]     - artboardRect[1];
  const gapRight  = detected[2]     - artboardRect[2];
  const gapBottom = artboardRect[3] - detected[3];
  if (gapLeft >= lo && gapLeft <= hi &&
      gapTop  >= lo && gapTop  <= hi &&
      gapRight >= lo && gapRight <= hi &&
      gapBottom >= lo && gapBottom <= hi) {
    return artboardRect;
  }
  // Case 1: ギャップなし → detected をそのまま返す
  return detected;
}

export function detectInspectionScope(doc: Document): ScopeInfo {
  const docLike = doc as unknown as DocumentLike;
  const layers = docLike.layers;

  // アートボード矩形を先取得（Step1/2 のギャップ補正で使用）
  const artboardsEarly = docLike.artboards;
  const idxEarly = typeof artboardsEarly.getActiveArtboardIndex === "function"
    ? artboardsEarly.getActiveArtboardIndex()
    : 0;
  const artboardEarly = artboardsEarly[idxEarly] || artboardsEarly[0];
  const artboardRectEarly: [number, number, number, number] | null = artboardEarly
    ? [artboardEarly.artboardRect[0], artboardEarly.artboardRect[1],
       artboardEarly.artboardRect[2], artboardEarly.artboardRect[3]]
    : null;

  // --- Step 1: レイヤー名でトンボ専用レイヤーを優先探索 ---
  // "トンボ" / "トリムマーク" / "Trim" / "tombo" 等の名前を持つレイヤーがあれば
  // そのレイヤー内の全ストロークパスを色フィルターなしで収集する
  // （専用レイヤーに置かれた以上、色に関わらずトンボとして扱う）
  const trimLayerPaths: PathItemLike[] = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerName = layer.name || "";
    if (isTrimMarkLayerName(layerName)) {
      collectAllStrokedPathsFromLayer(layer, trimLayerPaths);
    }
  }

  const layerCornerPaths = filterToCornerPaths(trimLayerPaths);
  const layerBounds = calcInnerBounds(layerCornerPaths);
  if (layerBounds !== null) {
    const adjustedLayer = artboardRectEarly
      ? adjustForTrimMarkGap(layerBounds, artboardRectEarly)
      : layerBounds;
    return { bounds: adjustedLayer, hasIncompleteMarks: false };
  }

  // --- Step 2: 全レイヤーからレジストレーションカラーのパスを探索 ---
  const trimPaths: PathItemLike[] = [];
  // ExtendScript 互換: Illustrator の layers コレクションは Symbol.iterator を持たないため
  // for...of ではなく for(var i) インデックスループを使用する
  for (let i = 0; i < layers.length; i++) {
    collectTrimMarkPaths(layers[i], trimPaths);
  }

  // Step 2 でトンボパスが見つかった場合は内周計算を試みる（四隅フィルタ適用）
  const regCornerPaths = filterToCornerPaths(trimPaths);
  const regBounds = calcInnerBounds(regCornerPaths);
  if (regBounds !== null) {
    const adjustedReg = artboardRectEarly
      ? adjustForTrimMarkGap(regBounds, artboardRectEarly)
      : regBounds;
    return { bounds: adjustedReg, hasIncompleteMarks: false };
  }

  // --- Step 3: artboard フォールバック ---
  // ExtendScript 互換: Document.activeArtboardIndex は存在しない。
  // Artboards.getActiveArtboardIndex() メソッドを使用し、なければ 0 にフォールバック
  const artboards = docLike.artboards;
  const idx = typeof artboards.getActiveArtboardIndex === "function"
    ? artboards.getActiveArtboardIndex()
    : 0;
  const artboard = artboards[idx] || artboards[0];
  // ExtendScript 互換: artboardRect は Illustrator ネイティブ配列のため
  // プレーンな JS 配列に変換して JSON.stringify が正しくシリアライズできるようにする
  const r = artboard.artboardRect;
  return {
    bounds: [r[0], r[1], r[2], r[3]] as [number, number, number, number],
    hasIncompleteMarks: false,
  };
}

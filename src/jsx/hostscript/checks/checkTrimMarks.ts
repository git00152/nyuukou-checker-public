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
  result: PathItemLike[],
  candidateBounds?: [number, number, number, number]
): void {
  // ExtendScript 互換: Illustrator のネイティブコレクションは Symbol.iterator を持たないため
  // for...of ではなく for(var i) インデックスループを使用する
  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
      const path = item as PathItemLike;
      if ((path as unknown as { guides?: boolean }).guides === true) continue;
      // ExtendScript の Illustrator では stroked が 1/0（数値）を返すことがあるため truthy チェック
      if (path.stroked && isRegistrationColor(path.strokeColor) &&
        (!candidateBounds || pathIntersectsBounds(path, candidateBounds))) {
        result.push(path);
      }
    } else if (item.typename === "GroupItem") {
      // GroupItem の中にあるトンボも再帰的に収集する
      const group = item as GroupItemLike;
      if (group.pageItems) {
        collectTrimMarkPathsFromItems(group.pageItems, result, candidateBounds);
      }
    }
  }
}

/** 色フィルターなし: トンボ専用レイヤー内の全ストロークパスを収集 */
function collectAllStrokedPathsFromItems(
  pageItems: PageItemOrGroupLike[],
  result: PathItemLike[],
  candidateBounds?: [number, number, number, number]
): void {
  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
      const path = item as PathItemLike;
      if ((path as unknown as { guides?: boolean }).guides === true) continue;
      // ExtendScript の Illustrator では stroked が 1/0（数値）を返すことがあるため truthy チェック
      if (path.stroked && (!candidateBounds || pathIntersectsBounds(path, candidateBounds))) {
        result.push(path);
      }
    } else if (item.typename === "GroupItem") {
      const group = item as GroupItemLike;
      if (group.pageItems) {
        collectAllStrokedPathsFromItems(group.pageItems, result, candidateBounds);
      }
    }
  }
}

function collectTrimMarkPaths(
  layer: LayerLike,
  result: PathItemLike[],
  candidateBounds?: [number, number, number, number]
): void {
  collectTrimMarkPathsFromItems(layer.pageItems, result, candidateBounds);
  const sublayers = layer.layers;
  for (let j = 0; j < sublayers.length; j++) {
    collectTrimMarkPaths(sublayers[j], result, candidateBounds);
  }
}

function collectAllStrokedPathsFromLayer(
  layer: LayerLike,
  result: PathItemLike[],
  candidateBounds?: [number, number, number, number]
): void {
  collectAllStrokedPathsFromItems(layer.pageItems, result, candidateBounds);
  const sublayers = layer.layers;
  for (let j = 0; j < sublayers.length; j++) {
    collectAllStrokedPathsFromLayer(sublayers[j], result, candidateBounds);
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

const TRIM_MARK_SEARCH_RATIO = 0.25;

function getArtboardRect(doc: DocumentLike, index?: number): [number, number, number, number] | null {
  const artboards = doc.artboards;
  if (!artboards || artboards.length <= 0) return null;
  const activeIndex = typeof artboards.getActiveArtboardIndex === "function"
    ? artboards.getActiveArtboardIndex()
    : 0;
  const selectedIndex = typeof index === "number" ? index : activeIndex;
  const artboard = artboards[selectedIndex] || artboards[0];
  if (!artboard || !artboard.artboardRect || artboard.artboardRect.length < 4) return null;
  const r = artboard.artboardRect;
  return [r[0], r[1], r[2], r[3]];
}

function expandRect(rect: [number, number, number, number]): [number, number, number, number] {
  const width = Math.abs(rect[2] - rect[0]);
  const height = Math.abs(rect[1] - rect[3]);
  const padding = Math.max(width, height) * TRIM_MARK_SEARCH_RATIO;
  return [rect[0] - padding, rect[1] + padding, rect[2] + padding, rect[3] - padding];
}

function pathIntersectsBounds(path: PathItemLike, bounds: [number, number, number, number]): boolean {
  try {
    const gb = path.geometricBounds;
    return !(gb[2] < bounds[0] || gb[0] > bounds[2] || gb[1] < bounds[3] || gb[3] > bounds[1]);
  } catch (_) {
    return false;
  }
}

function filterToCandidateRegion(paths: PathItemLike[], bounds: [number, number, number, number]): PathItemLike[] {
  const result: PathItemLike[] = [];
  for (let i = 0; i < paths.length; i++) {
    if (pathIntersectsBounds(paths[i], bounds)) result.push(paths[i]);
  }
  return result;
}

function estimateTrimMarkGap(
  detected: [number, number, number, number],
  artboardRect: [number, number, number, number]
): number | undefined {
  const margins = [
    Math.abs(artboardRect[0] - detected[0]),
    Math.abs(artboardRect[1] - detected[1]),
    Math.abs(artboardRect[2] - detected[2]),
    Math.abs(artboardRect[3] - detected[3]),
  ];
  const positive: number[] = [];
  for (let i = 0; i < margins.length; i++) {
    if (isFinite(margins[i]) && margins[i] > 0.01) positive.push(margins[i]);
  }
  if (positive.length !== 4) return undefined;
  positive.sort((a, b) => a - b);
  return (positive[1] + positive[2]) / 2;
}

function normalizeFinishBounds(
  detected: [number, number, number, number],
  artboardRect: [number, number, number, number],
): [number, number, number, number] {
  // Illustratorの標準トンボは仕上がり線の外側に配置されるため、
  // 検出した内周がアートボードを包含する場合はアートボードを仕上がり矩形とする。
  // 逆にアートボード内に独立した小さいトンボ矩形がある場合は検出矩形を保持する。
  if (
    detected[0] <= artboardRect[0] &&
    detected[1] >= artboardRect[1] &&
    detected[2] >= artboardRect[2] &&
    detected[3] <= artboardRect[3]
  ) {
    return artboardRect;
  }
  return detected;
}

export function detectInspectionScope(doc: Document, artboardIndex?: number): ScopeInfo {
  const docLike = doc as unknown as DocumentLike;
  const layers = docLike.layers;

  const artboardRectEarly = getArtboardRect(docLike, artboardIndex);
  if (!artboardRectEarly) {
    return { bounds: [0, 0, 0, 0], hasIncompleteMarks: true, scopeSource: "fallback", confidence: "low" };
  }
  const candidateBounds = expandRect(artboardRectEarly);

  // --- Step 1: レイヤー名でトンボ専用レイヤーを優先探索 ---
  // "トンボ" / "トリムマーク" / "Trim" / "tombo" 等の名前を持つレイヤーがあれば
  // そのレイヤー内の全ストロークパスを色フィルターなしで収集する
  // （専用レイヤーに置かれた以上、色に関わらずトンボとして扱う）
  const trimLayerPaths: PathItemLike[] = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerName = layer.name || "";
    if (isTrimMarkLayerName(layerName)) {
      collectAllStrokedPathsFromLayer(layer, trimLayerPaths, candidateBounds);
    }
  }

  // 対象アートボード周辺だけを候補にする。候補が空の場合に専用レイヤー
  // 全体へ広げると、隣接アートボードのトンボを誤って採用するため行わない。
  const layerCandidatePaths = filterToCandidateRegion(trimLayerPaths, candidateBounds);
  const layerCornerPaths = filterToCornerPaths(layerCandidatePaths);
  const layerBounds = calcInnerBounds(layerCornerPaths);
  if (layerBounds !== null) {
    const finishBounds = normalizeFinishBounds(layerBounds, artboardRectEarly);
    return {
      bounds: finishBounds,
      hasIncompleteMarks: false,
      scopeSource: "trim-marks",
      // Bounds alone cannot establish unique corners, directions or one mark set.
      confidence: "medium",
      notes: ["トリムマークの方向・四隅の一意性は未確定です。仕上がり範囲を確認してください。"],
      trimMarkGapPt: estimateTrimMarkGap(layerBounds, artboardRectEarly),
      normalInspectionBounds: candidateBounds,
    };
  }

  // --- Step 2: 全レイヤーからレジストレーションカラーのパスを探索 ---
  const trimPaths: PathItemLike[] = [];
  // ExtendScript 互換: Illustrator の layers コレクションは Symbol.iterator を持たないため
  // for...of ではなく for(var i) インデックスループを使用する
  for (let i = 0; i < layers.length; i++) {
    collectTrimMarkPaths(layers[i], trimPaths, candidateBounds);
  }

  // Step 2 でトンボパスが見つかった場合は内周計算を試みる（四隅フィルタ適用）
  const regCandidatePaths = filterToCandidateRegion(trimPaths, candidateBounds);
  const regCornerPaths = filterToCornerPaths(regCandidatePaths);
  const regBounds = calcInnerBounds(regCornerPaths);
  if (regBounds !== null) {
    const finishBounds = normalizeFinishBounds(regBounds, artboardRectEarly);
    return {
      bounds: finishBounds,
      hasIncompleteMarks: false,
      scopeSource: "trim-marks",
      confidence: "medium",
      notes: ["トリムマークの方向・四隅の一意性は未確定です。仕上がり範囲を確認してください。"],
      trimMarkGapPt: estimateTrimMarkGap(regBounds, artboardRectEarly),
      normalInspectionBounds: candidateBounds,
    };
  }

  // --- Step 3: artboard フォールバック ---
  // ExtendScript 互換: Document.activeArtboardIndex は存在しない。
  // Artboards.getActiveArtboardIndex() メソッドを使用し、なければ 0 にフォールバック
  return {
    bounds: artboardRectEarly,
    hasIncompleteMarks: false,
    scopeSource: "artboard",
    confidence: "high",
    normalInspectionBounds: artboardRectEarly,
  };
}

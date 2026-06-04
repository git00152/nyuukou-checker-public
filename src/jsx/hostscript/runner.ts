import { CheckResult, ScopeInfo } from "./types";
import { collectPathItems, collectTextFrames, collectPlacedItems, collectRasterItems } from "./inspector";
import { overlapsArtboard } from "./utils/coordinateUtils";
import { detectInspectionScope, isTrimMarkLayerName } from "./checks/checkTrimMarks";
import { checkEmptyPaths } from "./checks/checkEmptyPaths";
import { checkOpenPaths } from "./checks/checkOpenPaths";
import { checkStrayPoints } from "./checks/checkStrayPoints";
import { checkThinLines } from "./checks/checkThinLines";
import { checkTextOverflow } from "./checks/checkTextOverflow";
import { checkLiveText } from "./checks/checkLiveText";
import { checkHiddenLayers } from "./checks/checkHiddenLayers";
import { checkHiddenObjects } from "./checks/checkHiddenObjects";
import { checkDocumentColor } from "./checks/checkDocumentColor";
import { checkRasterEffect } from "./checks/checkRasterEffect";
import { checkImageResolution } from "./checks/checkImageResolution";
import { readLinkedImageColorMode } from "./checks/imageColorReader";
import { checkInkTotal } from "./checks/checkInkTotal";
import { checkOverprint } from "./checks/checkOverprint";
import { checkUnusedSwatches } from "./checks/checkUnusedSwatches";
import { checkSpotColors } from "./checks/checkSpotColors";
import { checkBleedCoverage } from "./checks/checkBleedCoverage";
import { checkSafeZone } from "./checks/checkSafeZone";

/**
 * runAll() に渡すオプション
 * largePrintMode: true の場合、IMG-03 チェッカーは 200dpi 以上を INFO として報告する
 */
export interface RunOptions {
  largePrintMode?: boolean;
  detectOpenPaths?: boolean;
  detectFilledOpenPaths?: boolean;
  includeGuides?: boolean;
  includeTrimMarkLayers?: boolean;
}

/**
 * runAll() の戻り値型
 * results: 全チェッカーの結果
 * scopeInfo: アートボード矩形情報（SVGPreview の viewBox 基準として使用）
 */
export interface RunAllResult {
  results: CheckResult[];
  scopeInfo: ScopeInfo;
  noDocument?: boolean;
}

function isGuidePathItem(item: PathItem): boolean {
  try {
    return (item as unknown as { guides?: boolean }).guides === true;
  } catch (e) {
    return false;
  }
}

export const runner = {
  /**
   * 全チェッカーを集約して CheckResult[] を返す
   * @param doc - チェック対象のドキュメント。省略時は app.activeDocument を使用
   * @param options - 実行オプション（largePrintMode 等）
   */
  runAll(doc?: Document, options?: RunOptions): RunAllResult {
    const opts: RunOptions = options ?? {};
    let targetDoc: Document;

    const fallbackScopeInfo: ScopeInfo = { bounds: [0, 0, 0, 0], hasIncompleteMarks: false };

    if (doc) {
      targetDoc = doc;
    } else {
      // ドキュメントが未開封の場合は例外がスローされるためキャッチして空の結果を返す
      try {
        targetDoc = app.activeDocument;
      } catch {
        return { results: [], scopeInfo: fallbackScopeInfo, noDocument: true };
      }
    }

    // ScopeInfo を一度だけ計算（BLEED チェッカーに渡す — 2 重呼び出し防止）
    // try/catch で包む: detectInspectionScope が throw した場合も runAll() をクラッシュさせない
    let scopeInfo: ReturnType<typeof detectInspectionScope>;
    let scopeDetectError: string | null = null;
    try {
      scopeInfo = detectInspectionScope(targetDoc);
    } catch (e) {
      scopeInfo = fallbackScopeInfo;
      // 診断用: エラー内容を保存して後で CHECK_FAILED として results に追加する
      // String(e) は ExtendScript の ES3 環境でも動作する
      scopeDetectError = "detectInspectionScope failed: " + String(e);
    }

    // アイテム収集
    // トンボレイヤー内のパスは全チェックから除外（Registration カラー等の誤検知防止）
    type ItemWithLayer = { layer?: { name?: string } };
    const pathItemsAll = (function () {
      const all = collectPathItems(targetDoc);
      const filtered: typeof all = [];
      const includeGuides = opts.includeGuides === true;
      const includeTrimMarkLayers = opts.includeTrimMarkLayers === true;
      for (let i = 0; i < all.length; i++) {
        // CompoundPathItem の子 PathItem など layer プロパティが投げる場合を保護する
        var layerName = "";
        try {
          const itemLayer = (all[i] as unknown as ItemWithLayer).layer;
          layerName = (itemLayer && itemLayer.name) ? itemLayer.name : "";
        } catch (e) {
          layerName = "";
        }
        if (!includeTrimMarkLayers && isTrimMarkLayerName(layerName)) continue;
        if (!includeGuides && isGuidePathItem(all[i])) continue;
        filtered.push(all[i]);
      }
      return filtered;
    }());
    const textFramesAll = collectTextFrames(targetDoc);
    const placedItems = collectPlacedItems(targetDoc);
    const rasterItems = collectRasterItems(targetDoc);
    // ExtendScript (ES3) 互換: スプレッド演算子は使用不可。concat を使用する。
    const allImageItemsAll = (placedItems as unknown[]).concat(rasterItems as unknown[]) as typeof placedItems;

    // アートボード外のオブジェクトを検出範囲から除外する
    // scopeInfo.bounds はトリムマーク内側エリア（仕上がりサイズ）のため、
    // 塗り足しエリアのパスが除外されてしまう。
    // アートボード矩形を直接取得し、フィルタ基準として使用する。
    // スコープ検出に失敗した場合（bounds=[0,0,0,0]）はフィルタリングをスキップする
    let ab: [number, number, number, number] = scopeInfo.bounds;
    try {
      const artboardsDoc = (targetDoc as unknown as {
        artboards: { getActiveArtboardIndex?: () => number; [key: number]: { artboardRect: number[] } };
      }).artboards;
      const artboardIdx = typeof artboardsDoc.getActiveArtboardIndex === "function"
        ? artboardsDoc.getActiveArtboardIndex()
        : 0;
      const ar = artboardsDoc[artboardIdx] && artboardsDoc[artboardIdx].artboardRect;
      if (ar && ar.length >= 4) {
        ab = [ar[0], ar[1], ar[2], ar[3]];
      }
    } catch (e) {
      // artboard 読み取りに失敗した場合は scopeInfo.bounds にフォールバック
    }
    const hasValidScope = (ab[2] > ab[0]) && (ab[1] > ab[3]);

    type ItemWithGB = { geometricBounds: [number, number, number, number] };

    // ExtendScript (ES3) 互換: Array.prototype.filter は使用不可。インデックスループを使用する。
    function filterByScope<T>(items: T[]): T[] {
      if (!hasValidScope) return items;
      const filtered: T[] = [];
      for (let i = 0; i < items.length; i++) {
        const gb = (items[i] as unknown as ItemWithGB).geometricBounds;
        if (gb && overlapsArtboard([gb[0], gb[1], gb[2], gb[3]], ab)) {
          filtered.push(items[i]);
        }
      }
      return filtered;
    }

    const pathItems = filterByScope(pathItemsAll);
    const textFrames = filterByScope(textFramesAll) as typeof textFramesAll;
    const allImageItems = filterByScope(allImageItemsAll);

    const allResults: CheckResult[] = [];

    // detectInspectionScope が throw した場合は診断エラーを結果に追加する
    if (scopeDetectError !== null) {
      allResults.push({
        severity: "INFO",
        messageKey: "CHECK_FAILED",
        message: "\u30C1\u30A7\u30C3\u30AF\u5B9F\u884C\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: " + scopeDetectError,
      });
    }

    // 各チェッカーを個別 try/catch で包み部分失敗を CHECK_FAILED に変換する
    // 順序: 軽量 O(1) → 中量 O(n) → 重量 O(n)+I/O
    const checkers: Array<() => CheckResult[]> = [
      // === 軽量: O(1) ドキュメント参照 ===
      () => checkHiddenLayers(targetDoc),
      () => checkDocumentColor(targetDoc as unknown as Parameters<typeof checkDocumentColor>[0]),
      () => checkRasterEffect(targetDoc as unknown as Parameters<typeof checkRasterEffect>[0]),
      () => checkUnusedSwatches(targetDoc as unknown as Parameters<typeof checkUnusedSwatches>[0]),

      // === 中量: O(n) パス/テキスト走査 ===
      () => checkEmptyPaths(pathItems),
      () => checkStrayPoints(pathItems),
      () => checkThinLines(pathItems),
      () => checkOpenPaths(pathItems, opts),
      () => checkHiddenObjects(targetDoc),
      () => checkInkTotal(pathItems as unknown as Parameters<typeof checkInkTotal>[0]),
      () => checkOverprint(pathItems as unknown as Parameters<typeof checkOverprint>[0]),
      () => checkSpotColors(pathItems as unknown as Parameters<typeof checkSpotColors>[0]),
      () => checkLiveText(textFrames),
      () => checkTextOverflow(textFrames),

      // === 重量: ファイル I/O・座標計算 ===
      () => checkImageResolution(allImageItems as unknown as Parameters<typeof checkImageResolution>[0], opts, undefined, readLinkedImageColorMode),
      () => checkBleedCoverage((pathItems as unknown[]).concat(allImageItems as unknown[]) as unknown as Parameters<typeof checkBleedCoverage>[0], scopeInfo),
      () => checkSafeZone(textFrames as unknown as Parameters<typeof checkSafeZone>[0], scopeInfo),
    ];

    // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
    for (let _ci = 0; _ci < checkers.length; _ci++) {
      try {
        const results = checkers[_ci]();
        for (let i = 0; i < results.length; i++) {
          allResults.push(results[i]);
        }
      } catch (e) {
        allResults.push({
          severity: "INFO",
          messageKey: "CHECK_FAILED",
          message: "\u30C1\u30A7\u30C3\u30AF\u5B9F\u884C\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: " + String(e),
        });
      }
    }

    return { results: allResults, scopeInfo };
  },
};

import { CheckResult, ScopeInfo } from "./types";
import { collectInspectionItems } from "./inspector";
import { BLEED_PT, overlapsArtboard } from "./utils/coordinateUtils";
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
import { checkRegistrationColor } from "./checks/checkRegistrationColor";
import { checkSavedVersion } from "./checks/checkSavedVersion";
import { getActiveArtboardIndex, getArtboardRect } from "./artboards";
import { applyProfileRules, type ColorWorkflow } from "./profiles";

/**
 * runAll() に渡すオプション
 * largePrintMode: true の場合、IMG-03 チェッカーは 200dpi 以上を INFO として報告する
 * colorWorkflow: 入稿プロファイル（未指定は "cmyk"）。"rgb" で RGB 入稿の基準に切り替える
 */
export interface RunOptions {
  largePrintMode?: boolean;
  colorWorkflow?: ColorWorkflow;
  detectOpenPaths?: boolean;
  detectFilledOpenPaths?: boolean;
  /** 後方互換のため受け取るが、ガイドは常に除外する。 */
  includeGuides?: boolean;
  includeTrimMarkLayers?: boolean;
  /** 明示されたアートボードだけを検査する。 */
  artboardIndex?: number;
  /** 文書全体検査（未使用スウォッチ等）を含める旧API用フラグ。 */
  includeDocumentWideChecks?: boolean;
  /** 保存互換バージョン検査を追加する新API用フラグ。 */
  includeSavedVersionCheck?: boolean;
  /** 必要塗り足し量。pt。未指定時はトンボ間隔または3mm。 */
  requiredBleedPt?: number;
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
      const requestedArtboardIndex = typeof opts.artboardIndex === "number"
        ? opts.artboardIndex
        : getActiveArtboardIndex(targetDoc);
      scopeInfo = detectInspectionScope(targetDoc, requestedArtboardIndex);
    } catch (e) {
      scopeInfo = fallbackScopeInfo;
      // 診断用: エラー内容を保存して後で CHECK_FAILED として results に追加する
      // String(e) は ExtendScript の ES3 環境でも動作する
      scopeDetectError = "detectInspectionScope failed: " + String(e);
    }

    const artboardIndex = typeof opts.artboardIndex === "number"
      ? opts.artboardIndex
      : getActiveArtboardIndex(targetDoc);
    let artboardBounds = getArtboardRect(targetDoc, artboardIndex);
    if (!artboardBounds) artboardBounds = scopeInfo.normalInspectionBounds || scopeInfo.bounds;

    // 画像・パスの走査範囲はアートボードを基準にする。トンボがある場合は
    // 検出した間隔、明示指定がある場合はその値まで外側を含める。
    const requestedBleedPt = typeof opts.requiredBleedPt === "number" && opts.requiredBleedPt >= 0
      ? opts.requiredBleedPt
      : (opts.includeDocumentWideChecks === false ? BLEED_PT : 0);
    if (requestedBleedPt > 0 && artboardBounds && artboardBounds.length >= 4) {
      artboardBounds = [
        artboardBounds[0] - requestedBleedPt,
        artboardBounds[1] + requestedBleedPt,
        artboardBounds[2] + requestedBleedPt,
        artboardBounds[3] - requestedBleedPt,
      ];
    }
    const collected = collectInspectionItems(targetDoc, artboardBounds || undefined);

    // 新APIで明示した要求値は ScopeInfo に保持し、BLEED チェッカーとUIが
    // 同じ値を使うようにする。旧APIの戻り値形状は変えない。
    if (typeof opts.requiredBleedPt === "number" || opts.includeDocumentWideChecks === false) {
      const nextScope: ScopeInfo = {
        bounds: scopeInfo.bounds,
        hasIncompleteMarks: scopeInfo.hasIncompleteMarks,
        scopeSource: scopeInfo.scopeSource,
        confidence: scopeInfo.confidence,
        trimMarkGapPt: scopeInfo.trimMarkGapPt,
        requiredBleedPt: typeof opts.requiredBleedPt === "number" ? opts.requiredBleedPt : BLEED_PT,
        requirementSource: typeof opts.requiredBleedPt === "number" ? "explicit" : "default",
        normalInspectionBounds: scopeInfo.normalInspectionBounds,
        notes: scopeInfo.notes,
      };
      scopeInfo = nextScope;
    }

    // アイテム収集
    // トンボレイヤー内のパスは全チェックから除外（Registration カラー等の誤検知防止）
    type ItemWithLayer = { layer?: { name?: string } };
    const pathItemsAll = (function () {
      const all = collected.pathItems;
      const filtered: typeof all = [];
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
        // ガイドは検査対象外。旧設定 includeGuides=true も安全側に無視する。
        if (isGuidePathItem(all[i])) continue;
        filtered.push(all[i]);
      }
      return filtered;
    }());
    const textFramesAll = collected.textFrames;
    const placedItems = collected.placedItems;
    const rasterItems = collected.rasterItems;
    // ExtendScript (ES3) 互換: スプレッド演算子は使用不可。concat を使用する。
    const allImageItemsAll = (placedItems as unknown[]).concat(rasterItems as unknown[]) as typeof placedItems;

    // アートボード外のオブジェクトを検出範囲から除外する
    // scopeInfo.bounds はトリムマーク内側エリア（仕上がりサイズ）のため、
    // 塗り足しエリアのパスが除外されてしまう。
    // アートボード矩形を直接取得し、フィルタ基準として使用する。
    // スコープ検出に失敗した場合（bounds=[0,0,0,0]）はフィルタリングをスキップする
    let ab: [number, number, number, number] = artboardBounds || scopeInfo.bounds;
    const hasValidScope = (ab[2] > ab[0]) && (ab[1] > ab[3]);

    const allResults: CheckResult[] = [];

    type ItemWithGB = { geometricBounds: [number, number, number, number] };

    // ExtendScript (ES3) 互換: Array.prototype.filter は使用不可。インデックスループを使用する。
    function filterByScope<T>(items: T[]): T[] {
      if (!hasValidScope) return items;
      const filtered: T[] = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const gb = (items[i] as unknown as ItemWithGB).geometricBounds;
          if (!gb || gb.length < 4 || !isFinite(gb[0]) || !isFinite(gb[1]) || !isFinite(gb[2]) || !isFinite(gb[3])) {
            throw new Error("Invalid geometricBounds");
          }
          if (overlapsArtboard([gb[0], gb[1], gb[2], gb[3]], ab)) filtered.push(items[i]);
        } catch (e) {
          allResults.push({ severity: "INFO", messageKey: "CHECK_FAILED", message: "Scope filter: " + String(e) });
        }
      }
      return filtered;
    }

    const pathItems = filterByScope(pathItemsAll);
    const textFrames = filterByScope(textFramesAll) as typeof textFramesAll;
    const allImageItems = filterByScope(allImageItemsAll);

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
    const checkers: Array<[string, () => CheckResult[]]> = [
      // === 軽量: O(1) ドキュメント参照 ===
      ["checkHiddenLayers", () => checkHiddenLayers(targetDoc)],
      ["checkDocumentColor", () => checkDocumentColor(targetDoc as unknown as Parameters<typeof checkDocumentColor>[0], opts.colorWorkflow)],
      ["checkRasterEffect", () => checkRasterEffect(targetDoc as unknown as Parameters<typeof checkRasterEffect>[0])],

      // === 中量: O(n) パス/テキスト走査 ===
      ["checkEmptyPaths", () => checkEmptyPaths(pathItems)],
      ["checkStrayPoints", () => checkStrayPoints(pathItems)],
      ["checkThinLines", () => checkThinLines(pathItems)],
      ["checkOpenPaths", () => checkOpenPaths(pathItems, opts)],
      ["checkHiddenObjects", () => checkHiddenObjects(targetDoc, ab)],
      ["checkInkTotal", () => checkInkTotal(pathItems as unknown as Parameters<typeof checkInkTotal>[0])],
      ["checkOverprint", () => checkOverprint(pathItems as unknown as Parameters<typeof checkOverprint>[0])],
      ["checkSpotColors", () => checkSpotColors(pathItems as unknown as Parameters<typeof checkSpotColors>[0])],
      ["checkLiveText", () => checkLiveText(textFrames)],
      ["checkTextOverflow", () => checkTextOverflow(textFrames)],

      // === 重量: ファイル I/O・座標計算 ===
      ["checkImageResolution", () => checkImageResolution(allImageItems as unknown as Parameters<typeof checkImageResolution>[0], opts, undefined, readLinkedImageColorMode)],
      ["checkBleedCoverage", () => checkBleedCoverage((pathItems as unknown[]).concat(allImageItems as unknown[]) as unknown as Parameters<typeof checkBleedCoverage>[0], scopeInfo, { largePrintMode: opts.largePrintMode })],
      ["checkSafeZone", () => checkSafeZone(textFrames as unknown as Parameters<typeof checkSafeZone>[0], scopeInfo)],
      ["checkRegistrationColor", () => checkRegistrationColor(pathItems as unknown as Parameters<typeof checkRegistrationColor>[0], scopeInfo)],
    ];

    // 文書全体結果は旧APIのみで実行する。アートボード別検査では
    // 未走査のままにして、文書全体を暗黙に収集しない。
    if (opts.includeDocumentWideChecks !== false) {
      checkers.splice(3, 0, ["checkUnusedSwatches", () => checkUnusedSwatches(targetDoc as unknown as Parameters<typeof checkUnusedSwatches>[0])]);
    }
    if (opts.includeSavedVersionCheck) {
      checkers.push(["checkSavedVersion", () => checkSavedVersion(targetDoc)]);
    }

    // ExtendScript (ES3) 互換: for...of は使用不可。インデックスループを使用する。
    for (let _ci = 0; _ci < checkers.length; _ci++) {
      try {
        const results = checkers[_ci][1]();
        for (let i = 0; i < results.length; i++) {
          allResults.push(results[i]);
        }
      } catch (e) {
        allResults.push({
          severity: "INFO",
          messageKey: "CHECK_FAILED",
          message: "\u30C1\u30A7\u30C3\u30AF\u5B9F\u884C\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: " + checkers[_ci][0] + ": " + String(e),
        });
      }
    }

    return { results: applyProfileRules(allResults, opts.colorWorkflow), scopeInfo };
  },
};

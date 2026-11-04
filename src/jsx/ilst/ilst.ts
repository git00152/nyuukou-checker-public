import { runner, RunOptions } from "../hostscript/runner";
import * as targetActions from "../hostscript/actions/targetActions";
import type { ArtboardDescriptor, CheckResult, CheckTargetRef, ScopeInfo } from "../hostscript/types";
import { artboardFingerprint, artboardsFingerprint, getActiveArtboardIndex, getArtboardDescriptors } from "../hostscript/artboards";

var checkedDocument: Document | null = null;
var checkedArtboardIndex = -1;
var checkedDocumentKey = "";
var inspectionEpochNumber = 0;
var scanCounter = 0;
var latestScanIds: { [index: string]: string } = {};
var latestPreviewPath = "";
var latestArtboardsFingerprint = "";

export interface ArtboardHostState {
  artboards: ArtboardDescriptor[];
  activeArtboardIndex: number;
  documentKey: string;
  inspectionEpoch: string;
  artboardsFingerprint: string;
  noDocument?: boolean;
}

export interface ArtboardRunResult {
  results: CheckResult[];
  scopeInfo: ScopeInfo;
  artboardIndex: number;
  scanId: string;
  documentKey: string;
  inspectionEpoch: string;
  artboardFingerprint: string;
  noDocument?: boolean;
}

function getDocumentKey(doc: Document): string {
  try {
    const fullName = (doc as unknown as { fullName?: { fsName?: string; toString?: () => string } }).fullName;
    if (fullName) return String(fullName.fsName || fullName.toString && fullName.toString() || "");
  } catch (_) { /* unsaved document */ }
  try {
    const name = (doc as unknown as { name?: string }).name;
    if (name) return String(name);
  } catch (_) { /* ignore */ }
  return "unsaved-document";
}

function getActiveDocument(): Document | null {
  try { return app.activeDocument; } catch (_) { return null; }
}

function cloneRunOptions(options: RunOptions | undefined): RunOptions {
  const source = options || {};
  const copy: RunOptions = {};
  const keys: Array<keyof RunOptions> = [
    "largePrintMode", "colorWorkflow", "detectOpenPaths", "detectFilledOpenPaths", "includeGuides",
    "includeTrimMarkLayers", "includeDocumentWideChecks", "includeSavedVersionCheck",
    "requiredBleedPt",
  ];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof source[key] !== "undefined") (copy as unknown as Record<string, unknown>)[key] = source[key];
  }
  return copy;
}

function decorateTargetRefs(results: CheckResult[], index: number, scanId: string, documentKey: string, epoch: string, fingerprint: string): void {
  for (let i = 0; i < results.length; i++) {
    const ref = results[i].targetRef;
    if (!ref) continue;
    ref.documentKey = documentKey;
    ref.inspectionEpoch = epoch;
    ref.scanId = scanId;
    ref.artboardIndex = index;
    ref.artboardFingerprint = fingerprint;
  }
}

function refreshDocumentState(doc: Document): void {
  const key = getDocumentKey(doc);
  const descriptors = getArtboardDescriptors(doc).artboards;
  const topology = artboardsFingerprint(descriptors);
  if (checkedDocument !== doc || checkedDocumentKey !== key || latestArtboardsFingerprint !== topology) {
    checkedDocument = doc;
    checkedDocumentKey = key;
    inspectionEpochNumber += 1;
    latestScanIds = {};
    latestArtboardsFingerprint = topology;
  }
}

export const runAll = (options?: RunOptions) => {
  checkedDocument = null;
  checkedDocumentKey = "";
  latestScanIds = {};
  var result = runner.runAll(undefined, options);
  if (!result.noDocument) {
    checkedDocument = app.activeDocument;
    checkedDocumentKey = getDocumentKey(checkedDocument);
    checkedArtboardIndex = getActiveArtboardIndex(checkedDocument);
    inspectionEpochNumber += 1;
  }
  return result;
};

/** ドキュメント全体を収集せず、アートボードのメタデータだけを返す。 */
export const getArtboards = (): ArtboardHostState => {
  const doc = getActiveDocument();
  if (!doc) {
    return {
      artboards: [],
      activeArtboardIndex: -1,
      documentKey: "",
      inspectionEpoch: String(inspectionEpochNumber),
      artboardsFingerprint: "",
      noDocument: true,
    };
  }
  refreshDocumentState(doc);
  const descriptorState = getArtboardDescriptors(doc);
  return {
    artboards: descriptorState.artboards,
    activeArtboardIndex: descriptorState.activeArtboardIndex,
    documentKey: checkedDocumentKey,
    inspectionEpoch: String(inspectionEpochNumber),
    artboardsFingerprint: artboardsFingerprint(descriptorState.artboards),
  };
};

/** 選択中のアートボードだけを収集・検査する。タブ切替ではこの関数を呼ばない。 */
export const runArtboardCheck = (index: number, options?: RunOptions): ArtboardRunResult | { results: CheckResult[]; scopeInfo: ScopeInfo; noDocument: true } => {
  const doc = getActiveDocument();
  if (!doc) return { results: [], scopeInfo: { bounds: [0, 0, 0, 0], hasIncompleteMarks: false }, noDocument: true };
  refreshDocumentState(doc);
  const descriptorState = getArtboardDescriptors(doc);
  let descriptor: ArtboardDescriptor | null = null;
  for (let i = 0; i < descriptorState.artboards.length; i++) {
    if (descriptorState.artboards[i].index === index) descriptor = descriptorState.artboards[i];
  }
  if (!descriptor) {
    return {
      results: [{ severity: "INFO", messageKey: "CHECK_FAILED", message: "指定したアートボードを確認できませんでした" }],
      scopeInfo: { bounds: [0, 0, 0, 0], hasIncompleteMarks: true },
      noDocument: false,
    } as ArtboardRunResult;
  }
  checkedArtboardIndex = index;
  const runOptions = cloneRunOptions(options);
  runOptions.artboardIndex = index;
  runOptions.includeDocumentWideChecks = false;
  runOptions.includeSavedVersionCheck = true;
  // A failed recheck must not leave the previous scan authorized for actions.
  delete latestScanIds[String(index)];
  const result = runner.runAll(undefined, runOptions);
  const scanId = "scan-" + String(++scanCounter) + "-" + String(index);
  const epoch = String(inspectionEpochNumber);
  const fingerprint = artboardFingerprint(descriptor);
  latestScanIds[String(index)] = scanId;
  decorateTargetRefs(result.results, index, scanId, checkedDocumentKey, epoch, fingerprint);
  return {
    results: result.results,
    scopeInfo: result.scopeInfo,
    artboardIndex: index,
    scanId,
    documentKey: checkedDocumentKey,
    inspectionEpoch: epoch,
    artboardFingerprint: fingerprint,
  };
};

function isCheckedDocumentActive(): boolean {
  try { return checkedDocument !== null && app.activeDocument === checkedDocument; }
  catch (_) { return false; }
}

// ExtendScript (ES3) 互換: 条件演算子の真側に条件演算子を入れ子にすると
// 読み込み時に「SyntaxError: 予期された結果: :」になるため if 文で書く。
export const selectCheckTarget = (ref: CheckTargetRef) => {
  if (!isCheckedDocumentActive()) return { ok: false, reason: "DOCUMENT_CHANGED" };
  if (!validateTargetContext(ref)) return { ok: false, reason: "STALE_SCAN" };
  return targetActions.selectCheckTarget(ref);
};

export const deleteCheckTarget = (ref: CheckTargetRef) => {
  if (!isCheckedDocumentActive()) return { ok: false, reason: "DOCUMENT_CHANGED" };
  if (!validateTargetContext(ref)) return { ok: false, reason: "STALE_SCAN" };
  return invalidateAfterTargetAction(targetActions.deleteCheckTarget(ref));
};

export const cleanupCheckTargets = (key: string, refs: CheckTargetRef[]) => {
  if (!isCheckedDocumentActive()) return { ok: false, reason: "DOCUMENT_CHANGED" };
  if (!validateAllTargetContexts(refs)) return { ok: false, reason: "STALE_SCAN" };
  return invalidateAfterTargetAction(targetActions.cleanupCheckTargets(key, refs));
};

function validateTargetContext(ref?: CheckTargetRef): boolean {
  if (!ref) return false;
  // 新しいアートボード走査の対象は、文書・走査世代・ボード・scanIdを
  // 一組で受け取る。部分的なコンテキストは検証をすり抜けるため拒否し、
  // 旧 runAll が返すコンテキスト無しの参照だけ後方互換で許可する。
  const hasContext = !!(
    ref.documentKey ||
    ref.inspectionEpoch ||
    ref.scanId ||
    typeof ref.artboardIndex === "number" ||
    ref.artboardFingerprint
  );
  if (hasContext && (
    !ref.documentKey ||
    !ref.inspectionEpoch ||
    !ref.scanId ||
    typeof ref.artboardIndex !== "number" ||
    !ref.artboardFingerprint
  )) return false;
  if (ref.documentKey && ref.documentKey !== checkedDocumentKey) return false;
  if (ref.inspectionEpoch && ref.inspectionEpoch !== String(inspectionEpochNumber)) return false;
  if (typeof ref.artboardIndex === "number") {
    if (!checkedDocument) return false;
    const currentArtboards = getArtboardDescriptors(checkedDocument);
    if (latestArtboardsFingerprint !== artboardsFingerprint(currentArtboards.artboards)) return false;
    let matched = false;
    for (let i = 0; i < currentArtboards.artboards.length; i++) {
      const board = currentArtboards.artboards[i];
      if (board.index !== ref.artboardIndex) continue;
      matched = true;
      if (ref.artboardFingerprint && ref.artboardFingerprint !== artboardFingerprint(board)) return false;
    }
    if (!matched) return false;
    if (ref.scanId && latestScanIds[String(ref.artboardIndex)] !== ref.scanId) return false;
  }
  return true;
}

function validateAllTargetContexts(refs?: CheckTargetRef[]): boolean {
  if (!refs || refs.length === 0) return false;
  for (let i = 0; i < refs.length; i++) {
    if (!validateTargetContext(refs[i])) return false;
  }
  return true;
}

function invalidateAfterTargetAction<T extends { ok: boolean; deletedCount?: number }>(result: T): T {
  if (result.ok || (typeof result.deletedCount === "number" && result.deletedCount > 0)) {
    inspectionEpochNumber += 1;
    latestScanIds = {};
  }
  return result;
}

export const cleanupPreview = (): void => {
  try {
    var paths = [Folder.temp + "/preflight-preview.png", latestPreviewPath];
    for (var i = 0; i < paths.length; i++) {
      if (!paths[i]) continue;
      var previewFile = new File(paths[i]);
      if (previewFile.exists) previewFile.remove();
    }
    latestPreviewPath = "";
  } catch (e) {
    // クリーンアップ失敗は無視
  }
};

export interface CleanupAcrobatCheckPdfResult {
  removed: boolean;
  error?: string;
}

export const cleanupAcrobatCheckPdf = (): CleanupAcrobatCheckPdfResult => {
  try {
    var pdfFile = new File(Folder.temp + "/nyuukou-acrobat-tac-check.pdf");
    if (!pdfFile.exists) {
      return { removed: false };
    }
    if (!pdfFile.remove()) return { removed: false, error: "File.remove failed" };
    return { removed: true };
  } catch (e) {
    return { removed: false, error: String(e) };
  }
};

export const exportArtboardPreview = (index?: number, scanId?: string): { filePath: string; artboardBounds: [number, number, number, number] } | string => {
  var switched = false;
  var previousIndex = -1;
  var artboardsForRestore: { setActiveArtboardIndex?: (index: number) => void } | null = null;
  try {
    var doc = app.activeDocument;
    var targetIndex = typeof index === "number" ? index : checkedArtboardIndex;
    if (checkedDocument && !isCheckedDocumentActive()) return "";
    if (scanId && latestScanIds[String(targetIndex)] !== scanId) return "";
    previousIndex = getActiveArtboardIndex(doc);
    var artboards = (doc as unknown as { artboards: { getActiveArtboardIndex?: () => number; setActiveArtboardIndex?: (index: number) => void; [key: number]: { artboardRect: number[] } } }).artboards;
    artboardsForRestore = artboards;
    if (previousIndex !== targetIndex) {
      if (!artboards || typeof artboards.setActiveArtboardIndex !== "function") return "";
      artboards.setActiveArtboardIndex(targetIndex);
      switched = true;
    }
    var exportName = "preflight-preview-" + String(targetIndex) + "-" + String(scanId || "latest") + ".png";
    var exportFile = new File(Folder.temp + "/" + exportName);
    var opts = new ExportOptionsPNG24();
    // @ts-ignore — ExtendScript 型定義に artBoardClipping がない場合
    opts.artBoardClipping = true;
    // スクリーン解像度（72dpi）でエクスポートしてファイルサイズを抑える
    opts.resolution = 72;
    doc.exportFile(exportFile, ExportType.PNG24, opts);
    // アクティブアートボードの矩形を取得（SVG での画像配置に使用）
    var idx = targetIndex;
    var r = artboards[idx].artboardRect;
    latestPreviewPath = exportFile.fsName;
    if (switched && artboards && typeof artboards.setActiveArtboardIndex === "function") {
      artboards.setActiveArtboardIndex(previousIndex);
      switched = false;
    }
    return {
      filePath: exportFile.fsName,
      artboardBounds: [r[0], r[1], r[2], r[3]] as [number, number, number, number],
    };
  } catch (e) {
    if (switched && artboardsForRestore && typeof artboardsForRestore.setActiveArtboardIndex === "function") {
      try { artboardsForRestore.setActiveArtboardIndex(previousIndex); } catch (_) { /* preserve export error */ }
    }
    return "";
  }
};

export interface AcrobatCheckPdfResult {
  filePath: string;
  error?: string;
  errorCode?: "DOCUMENT_NOT_SAVED" | "PDF_SAVE_FAILED";
}

export const exportAcrobatCheckPdf = (): AcrobatCheckPdfResult => {
  try {
    var doc = app.activeDocument;
    var pdfFile = new File(Folder.temp + "/nyuukou-acrobat-tac-check.pdf");
    if (pdfFile.exists) {
      pdfFile.remove();
    }

    try {
      doc.save();
    } catch (saveError) {
      return {
        filePath: "",
        errorCode: "DOCUMENT_NOT_SAVED",
        error: String(saveError),
      };
    }

    var options = new PDFSaveOptions();
    options.preserveEditability = true;
    options.viewAfterSaving = false;
    try {
      doc.saveAs(pdfFile, options);
    } catch (pdfSaveError) {
      return {
        filePath: "",
        errorCode: "PDF_SAVE_FAILED",
        error: String(pdfSaveError),
      };
    }

    return { filePath: pdfFile.fsName };
  } catch (e) {
    return { filePath: "", error: String(e) };
  }
};

import React, { useState, useEffect, useMemo, useRef } from "react";
import { evalTS, initBolt } from "../lib/utils/bolt";
import { child_process, fs } from "../lib/cep/node";
import { PreviewViewport } from "./components/PreviewViewport";
import { ResultList } from "./components/ResultList";
import { FilterBar } from "./components/FilterBar";
import { PanelButton } from "./components/PanelButton";
import { SettingsPanel } from "./components/SettingsPanel";
import { ProfileSelector } from "./components/ProfileSelector";
import type { ArtboardDescriptor, CheckResult, CheckTargetRef, ScopeInfo } from "../../jsx/hostscript/types";
import { diagnosticLog, errorToDiagnosticDetail } from "./utils/diagnosticLogger";
import { applyHostTheme, readHostTheme, subscribeHostTheme } from "./theme/hostTheme";
import { SettingsIcon } from "./components/icons";
import { loadSettings, saveSettings, type AppSettings, type ColorWorkflow } from "./settings";
import { useHostOperation } from "./hooks/useHostOperation";
import "./panel.css";

type CheckStatus = "idle" | "checking" | "done" | "error" | "no-document";
type Severity = "ERROR" | "WARNING" | "INFO";
type NoticeTone = "info" | "success" | "warning" | "error";

interface RunAllResult {
  results: CheckResult[];
  scopeInfo: ScopeInfo;
  noDocument?: boolean;
}

interface ArtboardHostState {
  artboards: ArtboardDescriptor[];
  activeArtboardIndex: number;
  documentKey: string;
  inspectionEpoch: string;
  artboardsFingerprint: string;
  noDocument?: boolean;
}

interface ArtboardCheckState {
  status: CheckStatus;
  results: CheckResult[];
  scopeInfo: ScopeInfo | null;
  scanId?: string;
  previewDataUrl: string | null;
  previewArtboardBounds: [number, number, number, number] | null;
  scannedSettings: AppSettings | null;
}

interface AcrobatCheckPdfResult {
  filePath: string;
  error?: string;
  errorCode?: "DOCUMENT_NOT_SAVED" | "PDF_SAVE_FAILED";
}

interface CleanupAcrobatCheckPdfResult {
  removed: boolean;
  error?: string;
}

interface TargetActionResult {
  ok: boolean;
  deletedCount?: number;
  failedCount?: number;
  reason?: string;
}

interface Notice {
  tone: NoticeTone;
  message: string;
}

const formatClock = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const getAcrobatExportErrorMessage = (result: AcrobatCheckPdfResult): string => {
  if (result.errorCode === "DOCUMENT_NOT_SAVED") {
    return "先にAIファイルとして保存してください";
  }
  if (result.errorCode === "PDF_SAVE_FAILED") {
    return "Acrobat確認用PDFの保存に失敗しました" + (result.error ? ": " + result.error : "");
  }
  return "Acrobat確認用PDFを作成できませんでした" + (result.error ? ": " + result.error : "");
};

const openAcrobatPdf = (pdfPath: string): Promise<void> => new Promise((resolve, reject) => {
  const appNames = ["Adobe Acrobat", "Adobe Acrobat Reader"];
  const tryOpen = (index: number): void => {
    (child_process.execFile as Function)("open", ["-a", appNames[index], pdfPath], (error: Error | null) => {
      if (!error) resolve();
      else if (index + 1 < appNames.length) tryOpen(index + 1);
      else reject(error);
    });
  };
  tryOpen(0);
});

const getTargetActionErrorMessage = (result: TargetActionResult, fallback: string): string => {
  const reasonMap: Record<string, string> = {
    NO_DOCUMENT: "ドキュメントを開いてください",
    DOCUMENT_CHANGED: "検査したドキュメントと異なります。対象のドキュメントで再チェックしてください",
    NOT_FOUND: "対象が見つかりませんでした。再チェックしてください",
    AMBIGUOUS: "対象を一意に特定できませんでした。再チェックまたは手動確認してください",
    LOCKED: "対象がロック中、非表示、または編集できない状態です",
    UNSUPPORTED_TARGET: "この検出項目はこの操作に対応していません",
    INVALID_TARGET_REF: "対象情報が古いか不正です。再チェックしてください",
    STILL_IN_USE: "スウォッチが使用中のため削除しませんでした",
    SYSTEM_SWATCH: "システムスウォッチは削除できません",
    REMOVE_FAILED: "削除に失敗しました",
    STALE_SCAN: "検査結果が古くなっています。対象のアートボードを再チェックしてください",
  };
  if (result.reason && reasonMap[result.reason]) return reasonMap[result.reason];
  return fallback;
};

export const App: React.FC = () => {
  // CEP 環境では index.js（ExtendScript）をロードして host[ns] と $["__serialize"] を設定する
  useEffect(() => {
    diagnosticLog("app initBolt start", { hasCep: typeof window.cep !== "undefined" });
    try {
      initBolt();
      diagnosticLog("app initBolt done");
    } catch (error) {
      diagnosticLog("app initBolt failed", errorToDiagnosticDetail(error));
      throw error;
    }
  }, []);

  // Illustrator の UI の明るさに配色を合わせ、環境設定で変更されたら追従する
  useEffect(() => {
    const root = document.documentElement;
    applyHostTheme(root, readHostTheme());
    return subscribeHostTheme((theme) => applyHostTheme(root, theme));
  }, []);

  // パネルを閉じたとき（unload）に一時プレビューファイルを削除する
  useEffect(() => {
    const handleUnload = () => {
      evalTS("cleanupPreview");
    };
    window.addEventListener("unload", handleUnload);
    return () => {
      window.removeEventListener("unload", handleUnload);
    };
  }, []);

  const [status, setStatus] = useState<CheckStatus>("idle");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [scopeInfo, setScopeInfo] = useState<ScopeInfo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [artboards, setArtboards] = useState<ArtboardDescriptor[]>([]);
  const [activeArtboardIndex, setActiveArtboardIndex] = useState<number | null>(null);
  const [artboardStates, setArtboardStates] = useState<Record<number, ArtboardCheckState>>({});
  const [documentKey, setDocumentKey] = useState("");
  const [artboardsFingerprint, setArtboardsFingerprint] = useState("");
  const checkRequestId = useRef(0);
  const [activeFilters, setActiveFilters] = useState<Set<Severity>>(
    new Set(["ERROR", "WARNING", "INFO"])
  );
  const [activeMessageKeys, setActiveMessageKeys] = useState<Set<string> | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [scannedSettings, setScannedSettings] = useState<AppSettings | null>(null);
  const needsRecheck = scannedSettings !== null && (
    ["colorWorkflow", "largePrintMode", "detectOpenPaths", "detectFilledOpenPaths", "includeTrimMarkLayers"] as const
  ).some((key) => settings[key] !== scannedSettings[key]);
  const [checkPhase, setCheckPhase] = useState("チェック中…");
  const { isBusy, runOperation } = useHostOperation();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewArtboardBounds, setPreviewArtboardBounds] = useState<[number, number, number, number] | null>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // 判定基準が変わるため、表示中の結果は needsRecheck の案内で再チェックを促す。
  const handleChangeColorWorkflow = (next: ColorWorkflow) => {
    if (next === settings.colorWorkflow) return;
    setSettings({ ...settings, colorWorkflow: next });
  };

  // 一覧取得はメタデータだけに限定し、PageItem走査はチェック実行時に行う。
  useEffect(() => {
    // CEPがない単体実行では一覧APIを呼ばず、旧runAll互換を使う。
    if (!window.cep) return;
    let cancelled = false;
    Promise.resolve(evalTS("getArtboards")).then((value) => {
      if (cancelled || !value || typeof value !== "object") return;
      const state = value as unknown as ArtboardHostState;
      if (!Array.isArray(state.artboards) || state.artboards.length === 0) {
        if (state.noDocument) {
          setStatus("no-document");
          // 文書が後から開かれた場合は、次のチェック直前に再取得する。
        }
        return;
      }
      setArtboards(state.artboards);
      setDocumentKey(state.documentKey || "");
      setArtboardsFingerprint(state.artboardsFingerprint || "");
      const initialIndex = state.artboards.some((board) => board.index === state.activeArtboardIndex)
        ? state.activeArtboardIndex
        : state.artboards[0].index;
      setActiveArtboardIndex(initialIndex);
    }).catch((error) => {
      // 旧ホストや単体テストでは一覧APIがないため、チェック時に旧APIへフォールバックする。
      diagnosticLog("artboard metadata unavailable", errorToDiagnosticDetail(error));
    });
    return () => { cancelled = true; };
  }, []);

  const visibleResults = useMemo(() => results.filter((result) =>
    activeFilters.has(result.severity) &&
    (activeMessageKeys === null || activeMessageKeys.has(result.messageKey))
  ), [results, activeFilters, activeMessageKeys]);

  const resetFilters = () => {
    setActiveFilters(new Set(["ERROR", "WARNING", "INFO"]));
    setActiveMessageKeys(null);
    setSelectedIndex(null);
  };

  const switchArtboard = (index: number) => {
    // 実行中の別ボード結果が表示中ボードへ流れ込まないよう失効させる。
    checkRequestId.current += 1;
    setActiveArtboardIndex(index);
    setSelectedIndex(null);
    setActiveMessageKeys(null);
    const cached = artboardStates[index];
    if (cached) {
      setStatus(cached.status);
      setResults(cached.results);
      setScopeInfo(cached.scopeInfo);
      setScannedSettings(cached.scannedSettings);
      setPreviewDataUrl(cached.previewDataUrl);
      setPreviewArtboardBounds(cached.previewArtboardBounds);
    } else {
      setStatus("idle");
      setResults([]);
      setScopeInfo(null);
      setScannedSettings(null);
      setPreviewDataUrl(null);
      setPreviewArtboardBounds(null);
      setNotice({ tone: "info", message: "このアートボードはまだチェックしていません" });
    }
  };

  // チェック実行は選択中アートボードだけを再走査する。
  const handleCheck = async () => {
    let requestedArtboardIndex = activeArtboardIndex;
    // React state の更新は非同期なので、チェック直前に取得したメタデータは
    // この実行内ではローカル変数で扱う。直後の setArtboards() の古い state を
    // 参照して旧 runAll にフォールバックしないため。
    let availableArtboards = artboards;
    const requestId = ++checkRequestId.current;
    diagnosticLog("check start", { settings, activeArtboardIndex: requestedArtboardIndex });
    setStatus("checking");
    setCheckPhase("チェック中…");
    setResults([]);
    setActiveMessageKeys(null);
    setScopeInfo(null);
    setSelectedIndex(null);
    setErrorMessage("");
    setNotice(null);
    setPreviewDataUrl(null);
    setPreviewArtboardBounds(null);
    try {
      // チェック直前にもメタデータを更新し、文書切替・アートボード構成変更を
      // 古いタブやキャッシュのまま実行しない。
      if (window.cep) {
        try {
          const latest = await evalTS("getArtboards") as unknown as ArtboardHostState;
          if (requestId !== checkRequestId.current) return;
          if (latest && latest.noDocument) {
            availableArtboards = [];
            setArtboards([]);
            setArtboardStates({});
            setActiveArtboardIndex(null);
            setStatus("no-document");
            setNotice({ tone: "warning", message: "ドキュメントを開いてください" });
            return;
          }
          if (latest && Array.isArray(latest.artboards) && latest.artboards.length > 0) {
            const topologyChanged = latest.documentKey !== documentKey || latest.artboardsFingerprint !== artboardsFingerprint;
            availableArtboards = latest.artboards;
            setArtboards(latest.artboards);
            setDocumentKey(latest.documentKey || "");
            setArtboardsFingerprint(latest.artboardsFingerprint || "");
            if (topologyChanged) {
              setArtboardStates({});
              requestedArtboardIndex = latest.activeArtboardIndex;
              setActiveArtboardIndex(requestedArtboardIndex);
            } else if (requestedArtboardIndex === null || !latest.artboards.some((board) => board.index === requestedArtboardIndex)) {
              requestedArtboardIndex = latest.activeArtboardIndex;
              setActiveArtboardIndex(requestedArtboardIndex);
            }
          } else {
            throw new Error("アートボード一覧を取得できません。再チェックしてください");
          }
        } catch (metadataError) {
          diagnosticLog("artboard metadata refresh failed", errorToDiagnosticDetail(metadataError));
          throw metadataError;
        }
      }
      const options = {
        colorWorkflow: settings.colorWorkflow,
        largePrintMode: settings.largePrintMode,
        detectOpenPaths: settings.detectOpenPaths,
        detectFilledOpenPaths: settings.detectFilledOpenPaths,
        includeTrimMarkLayers: settings.includeTrimMarkLayers,
      };
      const useArtboardApi = availableArtboards.length > 0 && requestedArtboardIndex !== null;
      const runResult = useArtboardApi
        ? await evalTS("runArtboardCheck", requestedArtboardIndex as number, options)
        : await evalTS("runAll", { ...options, includeGuides: false });
      const result = runResult as unknown as RunAllResult & { noDocument?: boolean; scanId?: string; artboardIndex?: number };
      if (result.noDocument) {
        if (requestId !== checkRequestId.current) return;
        setStatus("no-document");
        setNotice({ tone: "warning", message: "ドキュメントを開いてください" });
        return;
      }
      const checkResults = result.results || [];
      const si = result.scopeInfo;
      if (requestId !== checkRequestId.current) {
        // 結果は要求元ボードのキャッシュにだけ残し、現在表示中のボードは変更しない。
        if (requestedArtboardIndex !== null) {
          const resultArtboardIndex = requestedArtboardIndex;
          setArtboardStates((previous) => ({
            ...previous,
            [resultArtboardIndex]: {
              status: "done",
              results: checkResults,
              scopeInfo: si,
              scanId: result.scanId,
              previewDataUrl: null,
              previewArtboardBounds: null,
              scannedSettings: settings,
            },
          }));
        }
        return;
      }
      setResults(checkResults);
      setScannedSettings(settings);
      setScopeInfo(si);
      setStatus("done");
      const failedCount = checkResults.filter((item) => item.messageKey === "CHECK_FAILED").length;
      setNotice(failedCount > 0
        ? { tone: "warning", message: `一部の検査を完了できませんでした（${failedCount}件）` }
        : { tone: "info", message: `チェック済み（${formatClock(new Date())}）` });

      setCheckPhase("プレビュー作成中…");
      let nextPreviewDataUrl: string | null = null;
      let nextPreviewBounds: [number, number, number, number] | null = null;
      try {
        const previewResult = useArtboardApi
          ? await evalTS("exportArtboardPreview", requestedArtboardIndex as number, result.scanId)
          : await evalTS("exportArtboardPreview");
        if (previewResult && typeof previewResult === "object" && (previewResult as { filePath?: string }).filePath && window.cep) {
          const preview = previewResult as { filePath: string; artboardBounds: [number, number, number, number] };
          const base64 = (fs.readFileSync as Function)(preview.filePath, "base64") as string;
          nextPreviewDataUrl = "data:image/png;base64," + base64;
          nextPreviewBounds = preview.artboardBounds;
          if (requestId === checkRequestId.current) {
            setPreviewDataUrl(nextPreviewDataUrl);
            setPreviewArtboardBounds(nextPreviewBounds);
          }
        }
      } catch (previewError) {
        diagnosticLog("preview export failed", errorToDiagnosticDetail(previewError));
        if (window.cep && requestId === checkRequestId.current) setNotice({ tone: "warning", message: "検査は完了しましたが、プレビューを作成できませんでした" });
      }
      if (requestedArtboardIndex !== null) {
        const resultArtboardIndex = requestedArtboardIndex;
        setArtboardStates((previous) => ({
          ...previous,
          [resultArtboardIndex]: {
            status: "done",
            results: checkResults,
            scopeInfo: si,
            scanId: result.scanId,
            previewDataUrl: nextPreviewDataUrl,
            previewArtboardBounds: nextPreviewBounds,
            scannedSettings: settings,
          },
        }));
      }
    } catch (e) {
      if (requestId !== checkRequestId.current) return;
      const errObj = e as Record<string, unknown>;
      const msg = typeof errObj?.message === "string" ? errObj.message : String(e);
      const noDocument = msg.includes("no document") || msg.includes("activeDocument");
      setNotice(noDocument ? { tone: "warning", message: "ドキュメントを開いてください" } : null);
      setErrorMessage(noDocument ? "" : msg);
      setStatus(noDocument ? "no-document" : "error");
      diagnosticLog("check failed", errorToDiagnosticDetail(e));
    }
  };

  // severity 選択 — フィルタ変更時に selectedIndex をリセット（Pitfall 3 対策）
  const selectSeverityFilter = (sev: Severity) => {
    setActiveFilters((prev) => {
      if (prev.size === 1 && prev.has(sev)) {
        return new Set(["ERROR", "WARNING", "INFO"]);
      }
      return new Set([sev]);
    });
    setSelectedIndex(null);
  };

  const toggleMessageKeyFilter = (messageKey: string) => {
    setActiveMessageKeys((prev) => {
      const allKeys = new Set(results.map((result) => result.messageKey));
      const next = new Set(prev ?? allKeys);
      if (next.has(messageKey)) {
        next.delete(messageKey);
      } else {
        next.add(messageKey);
      }
      return next.size === allKeys.size ? null : next;
    });
    setSelectedIndex(null);
  };

  const handleOpenAcrobatTacCheck = async () => {
    setCheckPhase("処理中…");
    diagnosticLog("acrobat tac start");
    setErrorMessage("");
    if (!window.confirm("現在のAIファイルを保存したあと、Acrobat確認用PDFとして一時保存します。続行しますか？")) {
      setNotice({ tone: "info", message: "Acrobat確認をキャンセルしました" });
      diagnosticLog("acrobat tac canceled");
      return;
    }
    setNotice({ tone: "info", message: "Acrobat確認用PDFを作成中です..." });
    try {
      const exportResult = await evalTS("exportAcrobatCheckPdf") as unknown as string | AcrobatCheckPdfResult;
      const pdfPath = typeof exportResult === "string" ? exportResult : exportResult.filePath;
      if (!pdfPath) {
        const message = typeof exportResult === "string"
          ? "Acrobat確認用PDFを作成できませんでした"
          : getAcrobatExportErrorMessage(exportResult);
        setErrorMessage(message);
        diagnosticLog("acrobat tac pdf export failed", {
          errorCode: typeof exportResult === "string" ? undefined : exportResult.errorCode,
          message,
        });
        return;
      }
      try {
        await openAcrobatPdf(pdfPath);
      } catch (error) {
        const message = "Adobe Acrobatを開けませんでした: " + String((error as Error).message || error);
        setErrorMessage(message);
        diagnosticLog("acrobat open failed", errorToDiagnosticDetail(error));
        setNotice(null);
        return;
      }
      const message = "Acrobat の 出力プレビュー で総インキ使用量を確認してください";
      setNotice({ tone: "success", message });
      diagnosticLog("acrobat tac opened");
    } catch (e) {
      const errObj = e as Record<string, unknown>;
      const msg = typeof errObj?.message === "string" ? errObj.message : String(e);
      const message = "Acrobat確認用PDFを作成できませんでした: " + msg;
      setErrorMessage(message);
      diagnosticLog("acrobat tac failed", errorToDiagnosticDetail(e));
    }
  };

  const handleCleanupAcrobatPdf = async () => {
    setCheckPhase("処理中…");
    diagnosticLog("acrobat temp pdf cleanup start");
    setErrorMessage("");
    try {
      const result = await evalTS("cleanupAcrobatCheckPdf") as unknown as CleanupAcrobatCheckPdfResult;
      if (result.error) {
        const message = "一時PDFを削除できませんでした: " + result.error;
        setErrorMessage(message);
        diagnosticLog("acrobat temp pdf cleanup failed", { message });
        return;
      }
      setNotice({
        tone: result.removed ? "success" : "info",
        message: result.removed ? "一時PDFを削除しました" : "削除対象の一時PDFはありません",
      });
      diagnosticLog("acrobat temp pdf cleanup done", { removed: result.removed });
    } catch (e) {
      const errObj = e as Record<string, unknown>;
      const msg = typeof errObj?.message === "string" ? errObj.message : String(e);
      const message = "一時PDFを削除できませんでした: " + msg;
      setErrorMessage(message);
      diagnosticLog("acrobat temp pdf cleanup failed", errorToDiagnosticDetail(e));
    }
  };

  const handleSelectTarget = async (result: CheckResult) => {
    setCheckPhase("処理中…");
    if (!result.targetRef) return;
    diagnosticLog("select target start", { messageKey: result.messageKey });
    setErrorMessage("");
    try {
      const selectResult = await evalTS("selectCheckTarget", result.targetRef) as unknown as TargetActionResult;
      if (!selectResult.ok) {
        const message = getTargetActionErrorMessage(selectResult, "対象を選択できませんでした");
        setErrorMessage(message);
        diagnosticLog("select target failed", { messageKey: result.messageKey, reason: selectResult.reason });
        return;
      }
      setNotice({ tone: "success", message: "Illustrator上で対象を選択しました" });
      diagnosticLog("select target done", { messageKey: result.messageKey });
    } catch (e) {
      const message = "対象を選択できませんでした: " + String((e as Error)?.message || e);
      setErrorMessage(message);
      diagnosticLog("select target failed", errorToDiagnosticDetail(e));
    }
  };

  const invalidateDeletedResults = () => {
    checkRequestId.current += 1;
    setArtboardStates({});
    setResults([]);
    setScopeInfo(null);
    setPreviewDataUrl(null);
    setPreviewArtboardBounds(null);
    setSelectedIndex(null);
    setStatus("idle");
    setNotice({ tone: "info", message: "削除により前回結果が無効になりました。再チェックしてください" });
  };

  const handleDeleteTarget = async (result: CheckResult) => {
    setCheckPhase("処理中…");
    if (!result.targetRef) return;
    if (settings.confirmBeforeDelete && !window.confirm("この検出対象を削除します。続行しますか？")) {
      setNotice({ tone: "info", message: "削除をキャンセルしました" });
      return;
    }
    diagnosticLog("delete target start", { messageKey: result.messageKey });
    setErrorMessage("");
    try {
      const deleteResult = await evalTS("deleteCheckTarget", result.targetRef) as unknown as TargetActionResult;
      if (deleteResult.ok || (deleteResult.deletedCount || 0) > 0) invalidateDeletedResults();
      if (!deleteResult.ok) {
        const message = getTargetActionErrorMessage(deleteResult, "対象を削除できませんでした");
        setErrorMessage(message);
        diagnosticLog("delete target failed", { messageKey: result.messageKey, reason: deleteResult.reason });
        return;
      }
      setNotice({ tone: "success", message: "対象を削除しました。再チェックします..." });
      await handleCheck();
    } catch (e) {
      const message = "対象を削除できませんでした: " + String((e as Error)?.message || e);
      setErrorMessage(message);
      diagnosticLog("delete target failed", errorToDiagnosticDetail(e));
    }
  };

  const handleCleanupTargets = async (messageKey: string, cleanupResults: CheckResult[]) => {
    setCheckPhase("処理中…");
    const targetRefs = cleanupResults
      .filter((result) => (result.actions || []).some((action) => action.id === "delete"))
      .map((result) => result.targetRef)
      .filter(Boolean) as CheckTargetRef[];
    if (targetRefs.length === 0) return;
    if (!window.confirm(`${targetRefs.length}件の対象を削除します。続行しますか？`)) {
      setNotice({ tone: "info", message: "一括削除をキャンセルしました" });
      return;
    }
    diagnosticLog("cleanup targets start", { messageKey, count: targetRefs.length });
    setErrorMessage("");
    try {
      const cleanupResult = await evalTS("cleanupCheckTargets", messageKey, targetRefs) as unknown as TargetActionResult;
      if (cleanupResult.ok || (cleanupResult.deletedCount || 0) > 0) invalidateDeletedResults();
      if (!cleanupResult.ok) {
        const message = getTargetActionErrorMessage(cleanupResult, "一部またはすべての対象を削除できませんでした");
        const failureMessage = `${message}（削除: ${cleanupResult.deletedCount || 0}件 / 失敗: ${cleanupResult.failedCount || 0}件）`;
        diagnosticLog("cleanup targets failed", { messageKey, reason: cleanupResult.reason });
        if ((cleanupResult.deletedCount || 0) > 0) {
          await handleCheck();
        }
        setErrorMessage(failureMessage);
        return;
      }
      setNotice({ tone: "success", message: `${cleanupResult.deletedCount || targetRefs.length}件を削除しました。再チェックします...` });
      await handleCheck();
    } catch (e) {
      const message = "一括削除できませんでした: " + String((e as Error)?.message || e);
      setErrorMessage(message);
      diagnosticLog("cleanup targets failed", errorToDiagnosticDetail(e));
    }
  };

  const statusLine: Notice | null = needsRecheck && status === "done"
    ? { tone: "warning", message: "条件が変わりました。再チェックしてください" }
    : notice;
  const buttonLabel = isBusy
    ? (status === "checking" || status === "done" ? checkPhase : "処理中…")
    : "チェック実行";

  return (
    <div className="app">
      {/* 左（狭い幅では上）: プレビュー */}
      <div className="app__preview">
        {artboards.length > 0 && (
          <div role="tablist" aria-label="アートボード" className="artboard-tabs">
            {artboards.map((board) => {
              const boardState = artboardStates[board.index];
              const isActive = activeArtboardIndex === board.index;
              const checkedCount = boardState?.status === "done" ? boardState.results.length : null;
              return (
                <button
                  key={board.index}
                  type="button"
                  role="tab"
                  className="artboard-tab"
                  aria-selected={isActive}
                  onClick={() => switchArtboard(board.index)}
                >
                  <span>{board.name || `アートボード ${board.index + 1}`}</span>
                  {checkedCount !== null && (
                    <span className="artboard-tab__state" aria-label={`検出 ${checkedCount}件`}>{checkedCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
          <PreviewViewport
            key={activeArtboardIndex === null ? "none" : String(activeArtboardIndex)}
            scopeInfo={scopeInfo}
            results={visibleResults}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            status={status}
            previewDataUrl={previewDataUrl}
            previewArtboardBounds={previewArtboardBounds}
            autoPanToSelection={settings.autoPanToSelection}
          />
        </div>
      </div>

      {/* 右（狭い幅では下）: 条件・実行・結果 */}
      <div className="app__controls">
        <div className="panel-header">
          <span className="panel-header__label">入稿</span>
          <ProfileSelector
            value={settings.colorWorkflow}
            onChange={handleChangeColorWorkflow}
            disabled={status === "checking"}
          />
          {settings.largePrintMode && <span className="panel-header__label">大判</span>}
          <span className="panel-header__spacer" />
          <PanelButton
            variant="quiet"
            icon
            aria-label="設定"
            title="設定"
            pressed={settingsOpen}
            onClick={() => setSettingsOpen((prev) => !prev)}
          >
            <SettingsIcon />
          </PanelButton>
        </div>

        <div className="run-bar">
          <PanelButton
            variant="primary"
            onClick={() => runOperation(handleCheck)}
            disabled={isBusy}
          >
            {buttonLabel}
          </PanelButton>
          <div className="run-bar__status" role="status" data-tone={statusLine?.tone}>
            {statusLine?.message}
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="inline-alert">{errorMessage}</div>
        )}

        {settingsOpen ? (
          <SettingsPanel
            settings={settings}
            onChangeSettings={setSettings}
            disabled={isBusy}
            onOpenAcrobatTacCheck={() => runOperation(handleOpenAcrobatTacCheck)}
            onCleanupAcrobatPdf={() => runOperation(handleCleanupAcrobatPdf)}
          />
        ) : (
          <>
            {results.length > 0 && (
              <FilterBar
                results={results}
                visibleCount={visibleResults.length}
                activeFilters={activeFilters}
                onSelectSeverityFilter={selectSeverityFilter}
                activeMessageKeys={activeMessageKeys}
                onToggleMessageKey={toggleMessageKeyFilter}
                onResetFilters={resetFilters}
              />
            )}
            <div className="results">
              {status === "idle" && results.length === 0 && (
                <div className="empty-state">
                  <p>アートボードを選んで「チェック実行」を押してください。文書設定・レイヤー・スウォッチは文書全体を対象にします。</p>
                </div>
              )}
              {status !== "error" && status !== "no-document" && (
                <ResultList
                  results={visibleResults}
                  totalCount={results.length}
                  onResetFilters={resetFilters}
                  actionsDisabled={isBusy}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                  hasScanned={status === "done"}
                  onSelectTarget={(result) => runOperation(() => handleSelectTarget(result))}
                  onDeleteTarget={(result) => runOperation(() => handleDeleteTarget(result))}
                  onCleanupTargets={(key, items) => runOperation(() => handleCleanupTargets(key, items))}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

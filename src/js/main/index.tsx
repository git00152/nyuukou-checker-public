import React, { useState, useEffect } from "react";
import { evalTS, initBolt } from "../lib/utils/bolt";
import { child_process, fs } from "../lib/cep/node";
import { PreviewViewport } from "./components/PreviewViewport";
import { ResultList } from "./components/ResultList";
import { FilterBar } from "./components/FilterBar";
import { IssueSummary } from "./components/IssueSummary";
import { PanelButton } from "./components/PanelButton";
import { SettingsPanel } from "./components/SettingsPanel";
import type { CheckResult, CheckTargetRef, ScopeInfo } from "../../jsx/hostscript/types";
import { diagnosticLog, errorToDiagnosticDetail } from "./utils/diagnosticLogger";
import { colors, panelSectionStyle, spacing } from "./styles/tokens";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings";

// Phase 3 全面刷新: 2ペインレイアウト + 全状態管理 + コンポーネント統合

// 疑似プログレス表示用ステップ名（ユニコードエスケープで文字化け防止）
const CHECKING_STEPS = [
  "\u30EC\u30A4\u30E4\u30FC\u306E\u691C\u67FB\u4E2D\u2026",       // レイヤーの検査中…
  "\u30D1\u30B9\u306E\u691C\u67FB\u4E2D\u2026",                    // パスの検査中…
  "\u753B\u50CF\u89E3\u50CF\u5EA6\u306E\u78BA\u8A8D\u4E2D\u2026",  // 画像解像度の確認中…
  "\u585A\u308A\u8DB3\u3057\u306E\u78BA\u8A8D\u4E2D\u2026",         // 塗り足しの確認中…
];

type CheckStatus = "idle" | "checking" | "done" | "error" | "no-document";
type Severity = "ERROR" | "WARNING" | "INFO";
type NoticeTone = "info" | "success" | "warning" | "error";

interface RunAllResult {
  results: CheckResult[];
  scopeInfo: ScopeInfo;
  noDocument?: boolean;
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

const NOTICE_STYLE: Record<NoticeTone, React.CSSProperties> = {
  info: {
    color: "#93c5fd",
    background: "rgba(96, 165, 250, 0.08)",
  },
  success: {
    color: "#86efac",
    background: "rgba(74, 222, 128, 0.10)",
  },
  warning: {
    color: "#f6ad55",
    background: "rgba(246, 173, 85, 0.08)",
  },
  error: {
    color: "#fc8181",
    background: "rgba(252, 129, 129, 0.08)",
  },
};

const getAcrobatExportErrorMessage = (result: AcrobatCheckPdfResult): string => {
  if (result.errorCode === "DOCUMENT_NOT_SAVED") {
    return "先にAIファイルとして保存してください";
  }
  if (result.errorCode === "PDF_SAVE_FAILED") {
    return "Acrobat確認用PDFの保存に失敗しました" + (result.error ? ": " + result.error : "");
  }
  return "Acrobat確認用PDFを作成できませんでした" + (result.error ? ": " + result.error : "");
};

const openAcrobatPdf = (
  pdfPath: string,
  onError: (error: Error) => void,
): void => {
  const appNames = ["Adobe Acrobat", "Adobe Acrobat Reader"];
  const tryOpen = (index: number): void => {
    (child_process.execFile as Function)(
      "open",
      ["-a", appNames[index], pdfPath],
      (error: Error | null) => {
        if (!error) return;
        if (index + 1 < appNames.length) {
          tryOpen(index + 1);
          return;
        }
        onError(error);
      }
    );
  };
  tryOpen(0);
};

const getTargetActionErrorMessage = (result: TargetActionResult, fallback: string): string => {
  const reasonMap: Record<string, string> = {
    NO_DOCUMENT: "ドキュメントを開いてください",
    NOT_FOUND: "対象が見つかりませんでした。再チェックしてください",
    AMBIGUOUS: "対象を一意に特定できませんでした。再チェックまたは手動確認してください",
    LOCKED: "対象がロック中、非表示、または編集できない状態です",
    UNSUPPORTED_TARGET: "この検出項目はこの操作に対応していません",
    INVALID_TARGET_REF: "対象情報が古いか不正です。再チェックしてください",
    STILL_IN_USE: "スウォッチが使用中のため削除しませんでした",
    SYSTEM_SWATCH: "システムスウォッチは削除できません",
    REMOVE_FAILED: "削除に失敗しました",
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
  const [activeFilters, setActiveFilters] = useState<Set<Severity>>(
    new Set(["ERROR", "WARNING", "INFO"])
  );
  const [activeMessageKeys, setActiveMessageKeys] = useState<Set<string> | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [checkingStep, setCheckingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [acrobatMessage, setAcrobatMessage] = useState<string>("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewArtboardBounds, setPreviewArtboardBounds] = useState<[number, number, number, number] | null>(null);

  // status が "checking" の間ステップ名をタイマーアニメーションで更新する
  // cleanup で clearInterval してメモリリークを防止する
  useEffect(() => {
    if (status !== "checking") {
      setCheckingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCheckingStep((prev) => (prev + 1) % CHECKING_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [status]);

  // 派生状態: フィルタ適用済みリスト
  const filteredResults = results.filter((r) => activeFilters.has(r.severity));
  const visibleResults = filteredResults.filter((r) => activeMessageKeys === null || activeMessageKeys.has(r.messageKey));

  // チェック実行ハンドラ
  const handleCheck = async () => {
    diagnosticLog("check start", { settings });
    setStatus("checking");
    setResults([]);
    setActiveMessageKeys(null);
    setScopeInfo(null);
    setSelectedIndex(null);
    setErrorMessage("");
    setAcrobatMessage("");
    setNotice({ tone: "info", message: "チェック中です..." });
    setPreviewDataUrl(null);
    setPreviewArtboardBounds(null);
    try {
      const runAllResult = await evalTS("runAll", {
        largePrintMode: settings.largePrintMode,
        detectOpenPaths: settings.detectOpenPaths,
        detectFilledOpenPaths: settings.detectFilledOpenPaths,
        includeGuides: settings.includeGuides,
        includeTrimMarkLayers: settings.includeTrimMarkLayers,
      });
      const { results: checkResults, scopeInfo: si } = runAllResult as unknown as RunAllResult;
      if ((runAllResult as unknown as RunAllResult).noDocument) {
        setStatus("no-document");
        setNotice({ tone: "warning", message: "ドキュメントを開いてください" });
        diagnosticLog("check no document");
        return;
      }
      setResults(checkResults);
      setActiveMessageKeys(null);
      setScopeInfo(si);
      setStatus("done");
      setNotice({ tone: "success", message: `チェックが完了しました。検出: ${checkResults.length}件` });
      diagnosticLog("check done", {
        count: checkResults.length,
        errorCount: checkResults.filter((result) => result.severity === "ERROR").length,
        warningCount: checkResults.filter((result) => result.severity === "WARNING").length,
        infoCount: checkResults.filter((result) => result.severity === "INFO").length,
      });
      // アートボードプレビュー画像を取得（CEP 環境のみ有効）
      // ExtendScript が { filePath, artboardBounds } を返し、CEP Node.js fs でファイルを読む
      try {
        const previewResult = await evalTS("exportArtboardPreview") as unknown as
          { filePath: string; artboardBounds: [number, number, number, number] } | string;
        if (previewResult && typeof previewResult === "object" && previewResult.filePath && window.cep) {
          const base64 = (fs.readFileSync as Function)(previewResult.filePath, "base64") as string;
          setPreviewDataUrl("data:image/png;base64," + base64);
          setPreviewArtboardBounds(previewResult.artboardBounds);
          diagnosticLog("preview export done");
        }
      } catch (previewError) {
        diagnosticLog("preview export failed", errorToDiagnosticDetail(previewError));
        // CEP 外（テスト環境等）では無視して previewDataUrl = null のまま
      }
    } catch (e) {
      const errObj = e as Record<string, unknown>;
      const msg = typeof errObj?.message === "string" ? errObj.message : String(e);
      if (msg.includes("no document") || msg.includes("activeDocument")) {
        setStatus("no-document");
        setNotice({ tone: "warning", message: "ドキュメントを開いてください" });
        diagnosticLog("check no document", { message: msg });
      } else {
        setErrorMessage(msg);
        setStatus("error");
        diagnosticLog("check failed", errorToDiagnosticDetail(e));
      }
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
    diagnosticLog("acrobat tac start");
    setAcrobatMessage("");
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
      openAcrobatPdf(pdfPath, (error) => {
        const message = "Adobe Acrobatを開けませんでした: " + error.message;
        setErrorMessage(message);
        diagnosticLog("acrobat open failed", errorToDiagnosticDetail(error));
      });
      const message = "Acrobat の 出力プレビュー で総インキ使用量を確認してください";
      setAcrobatMessage("");
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
    diagnosticLog("acrobat temp pdf cleanup start");
    setErrorMessage("");
    setAcrobatMessage("");
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

  const handleDeleteTarget = async (result: CheckResult) => {
    if (!result.targetRef) return;
    if (settings.confirmBeforeDelete && !window.confirm("この検出対象を削除します。続行しますか？")) {
      setNotice({ tone: "info", message: "削除をキャンセルしました" });
      return;
    }
    diagnosticLog("delete target start", { messageKey: result.messageKey });
    setErrorMessage("");
    try {
      const deleteResult = await evalTS("deleteCheckTarget", result.targetRef) as unknown as TargetActionResult;
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
      if (!cleanupResult.ok) {
        const message = getTargetActionErrorMessage(cleanupResult, "一部またはすべての対象を削除できませんでした");
        setErrorMessage(`${message}（削除: ${cleanupResult.deletedCount || 0}件 / 失敗: ${cleanupResult.failedCount || 0}件）`);
        diagnosticLog("cleanup targets failed", { messageKey, reason: cleanupResult.reason });
        if ((cleanupResult.deletedCount || 0) > 0) {
          await handleCheck();
        }
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

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        minWidth: "280px",
        minHeight: "300px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "13px",
        background: colors.appBg,
        color: colors.text,
      }}
    >
      {/* 左ペイン: PreviewViewport */}
      <div style={{ flex: 1, overflow: "hidden", background: colors.previewBg, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <PreviewViewport
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

      {/* 右ペイン: コントロール + フィルタ + リスト */}
      <div
        style={{
          minWidth: "220px",
          maxWidth: "400px",
          flexShrink: 1,
          flexGrow: 1,
          flexBasis: "220px",
          display: "flex",
          flexDirection: "column",
          borderLeft: `1px solid ${colors.panelBorder}`,
          background: colors.panelBg,
          overflow: "hidden",
        }}
      >
        {/* コントロールエリア */}
        <div
          style={{
            ...panelSectionStyle,
            padding: "12px 10px",
            background: colors.panelBgStrong,
          }}
        >
          {/* チェック実行ボタン */}
          <PanelButton
            onClick={handleCheck}
            disabled={status === "checking"}
            variant="primary"
            fullWidth
            style={{ padding: "9px 0" }}
          >
            {status === "checking" ? CHECKING_STEPS[checkingStep] : "チェック実行"}
          </PanelButton>

          <div
            style={{
              display: "grid",
              gap: spacing.md,
              marginTop: spacing.md,
            }}
          >
            <SettingsPanel
              settings={settings}
              onChangeSettings={setSettings}
              disabled={status === "checking"}
              onOpenAcrobatTacCheck={handleOpenAcrobatTacCheck}
              onCleanupAcrobatPdf={handleCleanupAcrobatPdf}
            />
          </div>
        </div>

        {notice && (
          <div
            role="status"
            style={{
              padding: "8px 10px",
              fontSize: "11px",
              borderBottom: "1px solid #2d3748",
              wordBreak: "break-word",
              flexShrink: 0,
              ...NOTICE_STYLE[notice.tone],
            }}
          >
            {notice.message}
          </div>
        )}

        {/* ステータス/エラーメッセージ */}
        {errorMessage && (
          <div
            style={{
              padding: "8px 10px",
              fontSize: "11px",
              color: "#fc8181",
              background: "rgba(252, 129, 129, 0.08)",
              borderBottom: "1px solid #2d3748",
              wordBreak: "break-word",
              flexShrink: 0,
            }}
          >
            {errorMessage}
          </div>
        )}

        {acrobatMessage && (
          <div
            style={{
              padding: "8px 10px",
              fontSize: "11px",
              color: "#93c5fd",
              background: "rgba(96, 165, 250, 0.08)",
              borderBottom: "1px solid #2d3748",
              wordBreak: "break-word",
              flexShrink: 0,
            }}
          >
            {acrobatMessage}
          </div>
        )}

        {/* FilterBar */}
        {results.length > 0 && (
          <div
            style={{
              ...panelSectionStyle,
              display: "grid",
              gap: spacing.md,
            }}
          >
            <IssueSummary results={results} visibleCount={visibleResults.length} />
            <FilterBar
              results={results}
              activeFilters={activeFilters}
              onSelectSeverityFilter={selectSeverityFilter}
              activeMessageKeys={activeMessageKeys}
              onToggleMessageKey={toggleMessageKeyFilter}
            />
          </div>
        )}

        {/* ResultList — スクロール可能エリア */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {status !== "error" && status !== "no-document" && (
            <ResultList
              results={visibleResults}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              hasScanned={status === "done"}
              onSelectTarget={handleSelectTarget}
              onDeleteTarget={handleDeleteTarget}
              onCleanupTargets={handleCleanupTargets}
            />
          )}
        </div>
      </div>
    </div>
  );
};

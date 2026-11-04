// @vitest-environment node
// tests/unit/ilst.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ilst.ts が依存する runner をモック
vi.mock("../../src/jsx/hostscript/runner", () => ({
  runner: { runAll: vi.fn() },
}));

// ExtendScript グローバル File・Folder のスタブ
// cleanupPreview は呼び出し時にこれらを参照するため、呼び出し前にスタブを設定する
const mockRemove = vi.fn(() => true);
const mockFileInstance: { exists: boolean; fsName: string; remove: () => void } = {
  exists: true,
  fsName: "/private/var/folders/test/T/nyuukou-acrobat-tac-check.pdf",
  remove: mockRemove,
};
const MockFile = vi.fn(function () { return mockFileInstance; });
vi.stubGlobal("File", MockFile);
vi.stubGlobal("Folder", { temp: "/private/var/folders/test/T" });

import { cleanupAcrobatCheckPdf, cleanupPreview, exportAcrobatCheckPdf } from "../../src/jsx/ilst/ilst";

describe("cleanupPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileInstance.exists = true;
  });

  it("Test 1: preflight-preview.png が存在する場合は remove を呼ぶ", () => {
    cleanupPreview();
    expect(mockRemove).toHaveBeenCalledOnce();
  });

  it("Test 2: ファイルが存在しない場合は remove を呼ばない", () => {
    mockFileInstance.exists = false;
    cleanupPreview();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("Test 3: remove がエラーを投げても例外をキャッチして無視する", () => {
    mockRemove.mockImplementationOnce(() => {
      throw new Error("IO error");
    });
    expect(() => cleanupPreview()).not.toThrow();
  });
});

describe("exportAcrobatCheckPdf", () => {
  const mockSaveAs = vi.fn();
  const mockSave = vi.fn();
  const mockDuplicate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileInstance.exists = false;
    mockSaveAs.mockReset();
    mockSave.mockReset();
    mockDuplicate.mockReset();
    vi.stubGlobal("PDFSaveOptions", vi.fn(function () { return {}; }));
    vi.stubGlobal("app", {
      activeDocument: {
        saved: true,
        save: mockSave,
        saveAs: mockSaveAs,
        duplicate: mockDuplicate,
      },
    });
  });

  it("PDF を現在の Document.saveAs で一時保存し、Document.duplicate は使わない", () => {
    const result = exportAcrobatCheckPdf();

    expect(mockDuplicate).not.toHaveBeenCalled();
    expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockSaveAs.mock.invocationCallOrder[0]);
    expect(mockSaveAs).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      filePath: "/private/var/folders/test/T/nyuukou-acrobat-tac-check.pdf",
    });
  });

  it("PDF 保存に失敗した場合は原因を含む error を返す", () => {
    mockSaveAs.mockImplementationOnce(() => {
      throw new Error("save failed");
    });

    const result = exportAcrobatCheckPdf();

    expect(result).toMatchObject({
      filePath: "",
      error: expect.stringContaining("save failed"),
    });
  });

  it("AI 保存に失敗した場合は PDF 保存せず、DOCUMENT_NOT_SAVED の errorCode を返す", () => {
    mockSave.mockImplementationOnce(() => {
      throw new Error("save ai failed");
    });

    const result = exportAcrobatCheckPdf();

    expect(mockSaveAs).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      filePath: "",
      errorCode: "DOCUMENT_NOT_SAVED",
      error: expect.stringContaining("save ai failed"),
    });
  });
});

describe("cleanupAcrobatCheckPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileInstance.exists = true;
  });

  it("一時PDFが存在する場合は削除して removed=true を返す", () => {
    const result = cleanupAcrobatCheckPdf();

    expect(mockRemove).toHaveBeenCalledOnce();
    expect(result).toEqual({ removed: true });
  });

  it("一時PDFが存在しない場合は removed=false を返す", () => {
    mockFileInstance.exists = false;

    const result = cleanupAcrobatCheckPdf();

    expect(mockRemove).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: false });
  });
});


describe("検査したドキュメントへの操作制限", () => {
  it("再検査が失敗しても旧scanIdの対象操作を失効させる", async () => {
    const host = await import("../../src/jsx/ilst/ilst");
    const { runner } = await import("../../src/jsx/hostscript/runner");
    vi.stubGlobal("app", { activeDocument: { artboards: [{ name: "A", artboardRect: [0, 100, 100, 0] }] } });
    const ref = { kind: "pathItem" as const, messageKey: "PATH_STRAY_01" };
    vi.mocked(runner.runAll).mockReturnValueOnce({
      results: [{ severity: "WARNING", messageKey: "PATH_STRAY_01", message: "test", targetRef: ref }],
      scopeInfo: { bounds: [0, 100, 100, 0], hasIncompleteMarks: false },
    });
    host.runArtboardCheck(0);
    vi.mocked(runner.runAll).mockImplementationOnce(() => { throw new Error("scan failed"); });
    expect(() => host.runArtboardCheck(0)).toThrow("scan failed");
    expect(host.selectCheckTarget(ref)).toEqual({ ok: false, reason: "STALE_SCAN" });
  });

  it("ドキュメントを切り替えた後の削除・選択・プレビューを止める", async () => {
    const host = await import("../../src/jsx/ilst/ilst");
    const { runner } = await import("../../src/jsx/hostscript/runner");
    vi.mocked(runner.runAll).mockReturnValue({ results: [], scopeInfo: { bounds: [0, 100, 100, 0], hasIncompleteMarks: false } });
    const doc = { artboards: { getActiveArtboardIndex: () => 0 } };
    vi.stubGlobal("app", { activeDocument: doc });
    host.runAll();
    vi.stubGlobal("app", { activeDocument: { ...doc } });
    const ref = { kind: "pathItem" as const };
    expect(host.deleteCheckTarget(ref)).toEqual({ ok: false, reason: "DOCUMENT_CHANGED" });
    expect(host.selectCheckTarget(ref)).toEqual({ ok: false, reason: "DOCUMENT_CHANGED" });
    expect(host.cleanupCheckTargets("PATH_STRAY_01", [ref])).toEqual({ ok: false, reason: "DOCUMENT_CHANGED" });
    expect(host.exportArtboardPreview()).toBe("");
  });

  it("runArtboardCheck は入稿プロファイル（colorWorkflow）を runner に渡す", async () => {
    const host = await import("../../src/jsx/ilst/ilst");
    const { runner } = await import("../../src/jsx/hostscript/runner");
    vi.stubGlobal("app", { activeDocument: { artboards: [{ name: "A", artboardRect: [0, 100, 100, 0] }] } });
    vi.mocked(runner.runAll).mockReturnValueOnce({ results: [], scopeInfo: { bounds: [0, 100, 100, 0], hasIncompleteMarks: false } });

    host.runArtboardCheck(0, { colorWorkflow: "rgb" });

    expect(vi.mocked(runner.runAll)).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ colorWorkflow: "rgb", artboardIndex: 0 }));
  });
});

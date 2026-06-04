// @vitest-environment node
// tests/unit/ilst.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ilst.ts が依存する runner をモック
vi.mock("../../src/jsx/hostscript/runner", () => ({
  runner: { runAll: vi.fn() },
}));

// ExtendScript グローバル File・Folder のスタブ
// cleanupPreview は呼び出し時にこれらを参照するため、呼び出し前にスタブを設定する
const mockRemove = vi.fn();
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

import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "../../src/js/main/index";

// evalTS モック
vi.mock("../../src/js/lib/utils/bolt", () => ({
  evalTS: vi.fn(),
  evalES: vi.fn(),
  initBolt: vi.fn(),
}));

// CEP Node.js fs モック（cep/node.ts は CEP 環境でのみ require('fs') を呼ぶ）
vi.mock("../../src/js/lib/cep/node", () => ({
  fs: { readFileSync: vi.fn() },
  child_process: { execFile: vi.fn() },
}));

import { evalTS } from "../../src/js/lib/utils/bolt";
import { child_process as mockChildProcess, fs as mockCepFs } from "../../src/js/lib/cep/node";
const mockEvalTS = vi.mocked(evalTS);
const mockReadFileSync = vi.mocked(mockCepFs.readFileSync);
const mockExecFile = vi.mocked(mockChildProcess.execFile);

const mockScopeInfo = { bounds: [0, 297, 210, 0] as [number, number, number, number], hasIncompleteMarks: false };

const openSettings = () => {
  fireEvent.click(screen.getByRole("button", { name: "設定" }));
};

describe("App (index.tsx) — 2ペインレイアウト統合テスト", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExecFile.mockImplementation((_file, _args, callback) => {
      (callback as Function)(null);
      return {} as ReturnType<typeof mockExecFile>;
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("CEP一覧取得が失敗してもチェック時に再試行し、旧APIへ進まない", async () => {
    const originalCep = (window as any).cep;
    (window as any).cep = {};
    try {
      mockEvalTS.mockRejectedValue(new Error("metadata unavailable"));
      render(<App />);
      await waitFor(() => expect(mockEvalTS).toHaveBeenCalledTimes(1));
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "チェック実行" })); });
      expect(mockEvalTS).toHaveBeenCalledTimes(2);
      expect(mockEvalTS.mock.calls.every(call => call[0] === "getArtboards")).toBe(true);
      expect(screen.getByRole("alert")).toHaveTextContent("metadata unavailable");
    } finally { (window as any).cep = originalCep; }
  });

  // Test 1: 初期状態（idle）で「チェック実行」ボタンが右ペインに表示される
  it("Test 1: 初期状態（idle）で「チェック実行」ボタンが表示される", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /チェック実行/ })).toBeInTheDocument();
  });

  // Test 2: 「大判印刷モード」チェックボックスが設定パネルに表示される
  it("Test 2: 「大判印刷モード」チェックボックスが設定パネルに表示される", () => {
    render(<App />);
    openSettings();
    const checkbox = screen.getByRole("checkbox", { name: /大判印刷モード/ });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("Test 2b: AcrobatでTAC確認ボタンが設定パネルに表示される", () => {
    render(<App />);
    openSettings();
    expect(screen.getByRole("button", { name: /AcrobatでTAC確認/ })).toBeInTheDocument();
  });

  // Test 3: チェック実行ボタンクリックで evalTS('runAll', settings) が呼ばれる
  it("Test 3: チェック実行ボタンクリックで evalTS('runAll', settings) が呼ばれる", async () => {
    mockEvalTS.mockResolvedValue({ results: [], scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(mockEvalTS).toHaveBeenCalledWith("runAll", {
        colorWorkflow: "cmyk",
        largePrintMode: false,
        detectOpenPaths: true,
        detectFilledOpenPaths: true,
        includeGuides: false,
        includeTrimMarkLayers: false,
      });
    });
  });

  it("設定変更後のチェック実行で runAll に反映される", async () => {
    mockEvalTS.mockResolvedValue({ results: [], scopeInfo: mockScopeInfo });
    render(<App />);
    openSettings();
    fireEvent.click(screen.getByRole("checkbox", { name: /大判印刷モード/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "オープンパス" }));
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));

    await waitFor(() => {
      expect(mockEvalTS).toHaveBeenCalledWith("runAll", expect.objectContaining({
        largePrintMode: true,
        detectOpenPaths: false,
        includeTrimMarkLayers: false,
      }));
    });
  });

  describe("入稿プロファイル", () => {
    it("設定を開かなくても入稿プロファイルを選べ、既定は CMYK 入稿", () => {
      render(<App />);
      expect(screen.getByRole("radio", { name: /CMYK入稿/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /RGB入稿/ })).not.toBeChecked();
    });

    it("RGB入稿を選ぶと runAll に colorWorkflow: rgb が渡る", async () => {
      mockEvalTS.mockResolvedValue({ results: [], scopeInfo: mockScopeInfo });
      render(<App />);
      fireEvent.click(screen.getByRole("radio", { name: /RGB入稿/ }));
      fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
      await waitFor(() => {
        expect(mockEvalTS).toHaveBeenCalledWith("runAll", expect.objectContaining({ colorWorkflow: "rgb" }));
      });
    });

    it("RGB入稿では Acrobat の TAC 確認を表示しない", () => {
      render(<App />);
      fireEvent.click(screen.getByRole("radio", { name: /RGB入稿/ }));
      openSettings();
      expect(screen.queryByRole("button", { name: /AcrobatでTAC確認/ })).not.toBeInTheDocument();
    });

    it("選んだ入稿プロファイルはパネルを開き直しても保持される", () => {
      const { unmount } = render(<App />);
      fireEvent.click(screen.getByRole("radio", { name: /RGB入稿/ }));
      unmount();
      render(<App />);
      expect(screen.getByRole("radio", { name: /RGB入稿/ })).toBeChecked();
    });
  });

  // Test 4: evalTS 呼び出し中（checking）に SVGPreview に status="checking" が渡る（スピナー表示）
  it("Test 4: チェック実行中にスピナーが表示される（status=checking）", async () => {
    mockEvalTS.mockReturnValue(new Promise(() => {})); // never resolves
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "チェック中…" })).toBeDisabled();
    });
  });

  // Test 5: evalTS が { results, scopeInfo } を返すと results と scopeInfo が state にセットされる
  it("Test 5: evalTS が結果を返すと results と scopeInfo が state にセットされる", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "e1", message: "エラーが発生しました" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      // scopeInfo がセットされると SVGPreview が SVG を描画し、results が ResultList に渡る
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
      expect(screen.getByText(/^チェック済み/)).toBeInTheDocument();
    });
    // SVGPreview が SVG を描画していること（querySelector で確認）
    const svgEl = document.querySelector("svg");
    expect(svgEl).not.toBeNull();
  });

  // Test 6: 結果取得後、filteredResults が SVGPreview と ResultList に渡る
  it("Test 6: 結果取得後、filteredResults が ResultList に表示される", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "e1", message: "エラーが発生しました" },
      { severity: "WARNING" as const, messageKey: "w1", message: "警告があります" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/警告があります/).length).toBeGreaterThan(0);
    });
  });

  // Test 7: FilterBar の ERROR ボタンで ERROR のみに絞り込まれる
  it("Test 7: FilterBar の ERROR ボタンで ERROR 件のみ表示される", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "e1", message: "エラーが発生しました" },
      { severity: "WARNING" as const, messageKey: "w1", message: "警告があります" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
    });
    // ERROR フィルタボタンをクリックして ERROR のみに絞り込む
    const errorFilterBtn = screen.getByRole("button", { pressed: true, name: /要修正/ });
    fireEvent.click(errorFilterBtn);
    await waitFor(() => {
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/警告があります/)).not.toBeInTheDocument();
    });
  });

  it("Test 7b: 孤立表示中の ERROR ボタンを再クリックすると全件表示に戻る", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "e1", message: "エラーが発生しました" },
      { severity: "WARNING" as const, messageKey: "w1", message: "警告があります" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/警告があります/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { pressed: true, name: /要修正/ }));
    await waitFor(() => {
      expect(screen.queryByText(/警告があります/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { pressed: true, name: /要修正/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/警告があります/).length).toBeGreaterThan(0);
    });
  });

  it("messageKey フィルタで検出項目単位に絞り込める", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "PATH_THIN_LINE_01", message: "細線があります" },
      { severity: "WARNING" as const, messageKey: "PATH_EMPTY_01", message: "空パスがあります" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/細線があります/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/空パスがあります/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "検出項目で絞り込む" }));
    fireEvent.click(screen.getByLabelText(/塗りなし・線なしの空パスが検出されました/));

    await waitFor(() => {
      expect(screen.getAllByText(/細線があります/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/空パスがあります/)).not.toBeInTheDocument();
    });
  });

  it("messageKey フィルタ変更時は選択中の項目を解除する", async () => {
    const results = [
      {
        severity: "ERROR" as const,
        messageKey: "PATH_THIN_LINE_01",
        message: "細線があります",
        bounds: [0, 297, 210, 200] as [number, number, number, number],
      },
      { severity: "WARNING" as const, messageKey: "PATH_EMPTY_01", message: "空パスがあります" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/細線があります/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /細線があります/ }));
    const errorItem = await waitFor(() => {
      const item = screen.getAllByTestId("result-number")[0].closest('[data-severity="ERROR"]');
      expect(item).not.toBeNull();
      return item as HTMLElement;
    });
    fireEvent.click(errorItem);
    await waitFor(() => {
      expect(screen.getByTestId("overlay-rect")).toHaveAttribute("data-selected", "true");
    });

    fireEvent.click(screen.getByRole("button", { name: "検出項目で絞り込む" }));
    fireEvent.click(screen.getByLabelText(/0.28pt未満の細線が検出されました/));

    expect(screen.queryByTestId("overlay-rect")).not.toBeInTheDocument();
  });

  // Test 8: フィルタ変更時に selectedIndex が null にリセットされる
  it("Test 8: フィルタ変更時に selectedIndex が null にリセットされる", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "e1", message: "エラーが発生しました", bounds: [0, 297, 210, 0] as [number, number, number, number] },
      { severity: "WARNING" as const, messageKey: "w1", message: "警告があります" },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/エラーが発生しました/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: /エラーが発生しました/ }));
    // リスト項目をクリックして selectedIndex を設定
    const errorItem = await waitFor(() => {
      const item = screen.getAllByTestId("result-number")[0].closest('[data-severity="ERROR"]');
      expect(item).not.toBeNull();
      return item as HTMLElement;
    });
    fireEvent.click(errorItem);
    // WARNING フィルタを選択して selectedIndex がリセットされることを確認
    const warningFilterBtn = screen.getByRole("button", { pressed: true, name: /要確認/ });
    fireEvent.click(warningFilterBtn);
    // selectedIndex がリセットされると overlay-rect の data-selected が "false" になるはず
    const overlayRects = screen.queryAllByTestId("overlay-rect");
    if (overlayRects.length > 0) {
      overlayRects.forEach(rect => {
        expect(rect.getAttribute("data-selected")).toBe("false");
      });
    }
    // フィルタ変更後のリスト表示確認（WARNING のみ表示）
    await waitFor(() => {
      expect(screen.queryByText(/エラーが発生しました/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/警告があります/).length).toBeGreaterThan(0);
    });
  });

  // Test 9: SVGPreview の onSelectIndex と ResultList の onSelectIndex が selectedIndex を共有している
  it("Test 9: ResultList の項目クリックで selectedIndex が共有される", async () => {
    const results = [
      { severity: "ERROR" as const, messageKey: "e1", message: "エラー1", bounds: [0, 297, 210, 200] as [number, number, number, number] },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/エラー1/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: /エラー1/ }));
    // ResultList 項目クリック → selectedIndex が 0 になる
    const errorItem = await waitFor(() => {
      const item = screen.getAllByTestId("result-number")[0].closest('[data-severity="ERROR"]');
      expect(item).not.toBeNull();
      return item as HTMLElement;
    });
    fireEvent.click(errorItem);
    // SVGPreview の overlay-rect が data-selected="true" になる
    await waitFor(() => {
      const rect = screen.getByTestId("overlay-rect");
      expect(rect.getAttribute("data-selected")).toBe("true");
    });
  });

  // Test 10: evalTS エラー時に "error" ステータスになり、エラーメッセージが表示される
  it("Test 10: evalTS エラー時にエラーメッセージが表示される", async () => {
    mockEvalTS.mockRejectedValue(new Error("unexpected error occurred"));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getByText(/unexpected error occurred/)).toBeInTheDocument();
    });
  });

  // Test 11: "no document" を含むエラーで "no-document" ステータスになる
  it("Test 11: 'no document' エラーで「ドキュメントを開いてください」が表示される", async () => {
    mockEvalTS.mockRejectedValue(new Error("no document open"));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getByText(/ドキュメントを開いてください/)).toBeInTheDocument();
    });
  });

  // Test 12: チェック実行後にデバッグUI要素が表示されない（gap closure 検証）
  it("Test 12: チェック実行後に DEBUG テキストが DOM に存在しない", async () => {
    const scopeInfo = { bounds: [0, 297, 210, 0] as [number, number, number, number], hasIncompleteMarks: false };
    mockEvalTS.mockResolvedValue({ results: [], scopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.queryByText(/DEBUG/)).toBeNull();
    });
  });

  // Test 13: scopeInfo が null の場合に DEBUG テキストが DOM に存在しない（gap closure 検証）
  it("Test 13: scopeInfo=null の status=done で DEBUG テキストが DOM に存在しない", async () => {
    mockEvalTS.mockResolvedValue({ results: [], scopeInfo: null });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.queryByText(/DEBUG/)).toBeNull();
    });
  });

  // Test 14: exportArtboardPreview が { filePath, artboardBounds } を返すと
  //           CEP 環境（window.cep あり）で fs.readFileSync で読み data URL が設定される
  it("Test 14: CEP 環境で exportArtboardPreview が { filePath, artboardBounds } を返すと data URL として previewDataUrl に設定される", async () => {
    // CEP 環境をシミュレート
    const originalCep = (window as any).cep;
    (window as any).cep = {};
    // fs.readFileSync がファイルパスを受け取り base64 文字列を返す
    (mockReadFileSync as ReturnType<typeof vi.fn>).mockReturnValue("abc123");

    // exportArtboardPreview は { filePath, artboardBounds } オブジェクトを返す
    const mockPreviewResult = {
      filePath: "/tmp/preflight-preview.png",
      artboardBounds: [-3, 300, 213, -3] as [number, number, number, number],
    };
    const metadata = { artboards: [{ index: 0, name: "A", rect: [0, 297, 210, 0] }], activeArtboardIndex: 0, documentKey: "doc", inspectionEpoch: "1", artboardsFingerprint: "A" };
    mockEvalTS
      .mockResolvedValueOnce(metadata)
      .mockResolvedValueOnce(metadata)
      .mockResolvedValueOnce({ results: [], scopeInfo: mockScopeInfo, scanId: "s1" })
      .mockResolvedValueOnce(mockPreviewResult);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      // evalTS が一覧・検査・プレビューの3回呼ばれていること
      expect(mockEvalTS).toHaveBeenCalledTimes(4);
      expect(mockEvalTS).toHaveBeenNthCalledWith(4, "exportArtboardPreview", 0, "s1");
    });
    // fs.readFileSync がファイルパスと 'base64' で呼ばれること
    expect(mockReadFileSync).toHaveBeenCalledWith("/tmp/preflight-preview.png", "base64");
    // data URL が設定されると preview-image 要素が表示される
    await waitFor(() => {
      const previewImg = document.querySelector("[data-testid='preview-image']");
      expect(previewImg).not.toBeNull();
      expect(previewImg?.getAttribute("href")).toBe("data:image/png;base64,abc123");
    });

    // クリーンアップ
    (window as any).cep = originalCep;
  });

  // Test 15: evalTS('exportArtboardPreview') が例外を投げても App がエラーステータスにならない（graceful fallback）
  it("Test 15: exportArtboardPreview が例外を投げても App はエラー状態にならない（graceful fallback）", async () => {
    mockEvalTS
      .mockResolvedValueOnce({ results: [], scopeInfo: mockScopeInfo })
      .mockRejectedValueOnce(new Error("CEP not available"));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      // status が "done" になること（エラー状態にならない）
      expect(screen.getByRole("button", { name: /チェック実行/ })).toBeInTheDocument();
    });
    // エラーメッセージが表示されていないこと
    expect(screen.queryByText(/CEP not available/)).toBeNull();
    // preview-image 要素が存在しないこと（data URL が設定されていない）
    expect(document.querySelector("[data-testid='preview-image']")).toBeNull();
  });

  // Test 18: status が "checking" から "done" に変わったとき、ボタンテキストが「チェック実行」に戻る
  it("Test 18: status が done に戻るとボタンテキストが「チェック実行」に戻る", async () => {
    mockEvalTS.mockResolvedValue({ results: [], scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /チェック実行/ })).toBeInTheDocument();
    });
  });

  // Test 19: パネルを閉じる（unload）時に evalTS("cleanupPreview") が呼ばれる
  it("Test 19: パネルを閉じる（unload）時に evalTS('cleanupPreview') が呼ばれる", () => {
    render(<App />);
    act(() => {
      window.dispatchEvent(new Event("unload"));
    });
    expect(mockEvalTS).toHaveBeenCalledWith("cleanupPreview");
  });

  // Test 16: exportArtboardPreview が "" を返したとき（= エクスポート失敗）previewDataUrl は設定されない
  it("Test 16: exportArtboardPreview が空文字（エクスポート失敗）を返したとき previewDataUrl は設定されない", async () => {
    mockEvalTS
      .mockResolvedValueOnce({ results: [], scopeInfo: mockScopeInfo })
      .mockResolvedValueOnce("");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    await waitFor(() => {
      expect(mockEvalTS).toHaveBeenCalledTimes(2);
    });
    // data URL が設定されないため preview-image 要素は存在しない
    expect(document.querySelector("[data-testid='preview-image']")).toBeNull();
  });

  it("Test 20: AcrobatでTAC確認ボタンでPDFを書き出してAcrobatで開く", async () => {
    mockEvalTS.mockResolvedValue({ filePath: "/tmp/nyuukou-acrobat-check.pdf" });
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("現在のAIファイルを保存"));
      expect(mockEvalTS).toHaveBeenCalledWith("exportAcrobatCheckPdf");
      expect(mockExecFile).toHaveBeenCalledWith(
        "open",
        ["-a", "Adobe Acrobat", "/tmp/nyuukou-acrobat-check.pdf"],
        expect.any(Function)
      );
      expect(screen.getByText(/Acrobat の 出力プレビュー/)).toBeInTheDocument();
    });
  });

  it("Test 20b: Acrobat確認をキャンセルした場合はPDFを書き出さない", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    render(<App />);
    openSettings();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ })); });

    expect(mockEvalTS).not.toHaveBeenCalledWith("exportAcrobatCheckPdf");
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(screen.getByText(/Acrobat確認をキャンセルしました/)).toBeInTheDocument();
  });

  it("Test 20d: Adobe Acrobat を開けない場合は Adobe Acrobat Reader を試す", async () => {
    mockEvalTS.mockResolvedValue({ filePath: "/tmp/nyuukou-acrobat-check.pdf" });
    mockExecFile
      .mockImplementationOnce((_file, _args, callback) => {
        (callback as Function)(new Error("Acrobat not found"));
        return {} as ReturnType<typeof mockExecFile>;
      })
      .mockImplementationOnce(() => ({} as ReturnType<typeof mockExecFile>));
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ }));

    await waitFor(() => {
      expect(mockExecFile).toHaveBeenNthCalledWith(
        2,
        "open",
        ["-a", "Adobe Acrobat Reader", "/tmp/nyuukou-acrobat-check.pdf"],
        expect.any(Function)
      );
    });
  });

  it("Test 20c: Acrobat確認用PDFの作成中通知を表示する", async () => {
    mockEvalTS.mockReturnValue(new Promise(() => {}));
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ }));

    expect(await screen.findByText(/Acrobat確認用PDFを作成中です/)).toBeInTheDocument();
  });

  it("Test 21: Acrobat確認用PDFの書き出しに失敗した場合はエラーを表示する", async () => {
    mockEvalTS.mockResolvedValue("");
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ }));

    await waitFor(() => {
      expect(screen.getByText(/Acrobat確認用PDFを作成できませんでした/)).toBeInTheDocument();
    });
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("Test 21b: Acrobat確認用PDFの書き出し失敗理由が返った場合は理由も表示する", async () => {
    mockEvalTS.mockResolvedValue({ filePath: "", error: "save failed" });
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ }));

    await waitFor(() => {
      expect(screen.getByText(/Acrobat確認用PDFを作成できませんでした: save failed/)).toBeInTheDocument();
    });
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("Test 21bb: 未保存ドキュメントの errorCode は UI 側で日本語表示する", async () => {
    mockEvalTS.mockResolvedValue({ filePath: "", errorCode: "DOCUMENT_NOT_SAVED", error: "save ai failed" });
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /AcrobatでTAC確認/ }));

    await waitFor(() => {
      expect(screen.getByText(/先にAIファイルとして保存してください/)).toBeInTheDocument();
      expect(screen.queryByText(/save ai failed/)).not.toBeInTheDocument();
    });
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("Test 21c: 一時PDF削除ボタンで cleanupAcrobatCheckPdf を呼び、削除完了通知を表示する", async () => {
    mockEvalTS.mockResolvedValue({ removed: true });
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /一時PDFを削除/ }));

    await waitFor(() => {
      expect(mockEvalTS).toHaveBeenCalledWith("cleanupAcrobatCheckPdf");
      expect(screen.getByText(/一時PDFを削除しました/)).toBeInTheDocument();
    });
  });

  it("Test 21d: 削除対象の一時PDFがない場合は通知を表示する", async () => {
    mockEvalTS.mockResolvedValue({ removed: false });
    render(<App />);
    openSettings();

    fireEvent.click(screen.getByRole("button", { name: /一時PDFを削除/ }));

    await waitFor(() => {
      expect(screen.getByText(/削除対象の一時PDFはありません/)).toBeInTheDocument();
    });
  });

  it("Test 22: 閉じた結果グループは別グループ内の結果クリック後も閉じたまま維持される", async () => {
    const results = [
      {
        severity: "INFO" as const,
        messageKey: "COLOR_INK_DECIMAL_01",
        message: "CMYK 値に小数点が含まれています",
      },
      {
        severity: "INFO" as const,
        messageKey: "COLOR_INK_DECIMAL_01",
        message: "CMYK 値に小数点が含まれています",
      },
      {
        severity: "WARNING" as const,
        messageKey: "TEXT_LIVE_01",
        message: "ライブテキストが残存しています",
      },
    ];
    mockEvalTS.mockResolvedValue({ results, scopeInfo: mockScopeInfo });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));

    const infoHeader = await screen.findByRole("button", {
      name: /CMYK 値に小数点が含まれています/,
    });
    fireEvent.click(screen.getByRole("button", {
      name: /ライブテキストが残存しています/,
    }));
    const warningItem = await waitFor(() => {
      const item = screen.getByText("3").closest('[data-severity="WARNING"]');
      expect(item).not.toBeNull();
      return item as HTMLElement;
    });

    expect(infoHeader).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector('[data-severity="INFO"]')).toBeNull();

    fireEvent.click(warningItem);

    expect(infoHeader).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector('[data-severity="INFO"]')).toBeNull();
  });

  it("検出結果の選択ボタンで selectCheckTarget を呼ぶ", async () => {
    const results = [{
      severity: "WARNING" as const,
      messageKey: "CUSTOM_PATH_CHECK_01",
      message: "対象パスがあります",
      targetRef: { kind: "pathItem" as const, messageKey: "CUSTOM_PATH_CHECK_01" },
      actions: [],
    }];
    mockEvalTS
      .mockResolvedValueOnce({ results, scopeInfo: mockScopeInfo })
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce({ ok: true });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    fireEvent.click(await screen.findByRole("button", { name: /対象パスがあります/ }));
    fireEvent.click(screen.getByRole("button", { name: "編集画面で選択" }));

    await waitFor(() => {
      expect(mockEvalTS).toHaveBeenCalledWith("selectCheckTarget", results[0].targetRef);
      expect(screen.getByText(/Illustrator上で対象を選択しました/)).toBeInTheDocument();
    });
  });

  it("検出結果の削除ボタンで deleteCheckTarget を呼び、成功後に再チェックする", async () => {
    const results = [{
      severity: "WARNING" as const,
      messageKey: "PATH_STRAY_01",
      message: "孤立点があります",
      targetRef: { kind: "pathItem" as const, messageKey: "PATH_STRAY_01" },
      actions: [{ id: "delete" as const, label: "削除", destructive: true }],
    }];
    mockEvalTS
      .mockResolvedValueOnce({ results, scopeInfo: mockScopeInfo })
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce({ ok: true, deletedCount: 1, failedCount: 0 })
      .mockResolvedValueOnce({ results: [], scopeInfo: mockScopeInfo })
      .mockResolvedValueOnce("");
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /チェック実行/ }));
    fireEvent.click(await screen.findByRole("button", { name: /孤立点があります/ }));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("この検出対象を削除"));
      expect(mockEvalTS).toHaveBeenCalledWith("deleteCheckTarget", results[0].targetRef);
      expect(mockEvalTS).toHaveBeenCalledWith("runAll", expect.any(Object));
    });
  });
});

describe("検査結果の状態と操作の回帰", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockExecFile.mockImplementation((_file, _args, callback) => {
      (callback as Function)(null);
      return {} as ReturnType<typeof mockExecFile>;
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("フィルタで0件になっても問題なしと表示せず、解除で結果を戻す", async () => {
    mockEvalTS.mockResolvedValue({ results: [{ severity: "ERROR", messageKey: "err", message: "修正が必要な検出" }], scopeInfo: mockScopeInfo });
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "チェック実行" })); });
    fireEvent.click(screen.getByRole("button", { name: "検出項目で絞り込む" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /err/ }));
    expect(screen.queryByText(/問題は検出されませんでした/)).not.toBeInTheDocument();
    expect(screen.getByText(/このフィルタに一致する結果はありません/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "フィルタを解除" }));
    expect(screen.getByRole("button", { name: /修正が必要な検出/ })).toBeInTheDocument();
  });

  it("プレビューを待っている間は再検査と補助操作を開始させない", async () => {
    let finish!: (value: string) => void;
    mockEvalTS.mockResolvedValueOnce({ results: [], scopeInfo: mockScopeInfo })
      .mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "チェック実行" }));
    const checking = await screen.findByRole("button", { name: "プレビュー作成中…" });
    expect(checking).toBeDisabled();
    openSettings();
    expect(screen.getByRole("button", { name: "AcrobatでTAC確認" })).toBeDisabled();
    fireEvent.click(checking);
    expect(mockEvalTS.mock.calls.filter(call => call[0] === "runAll")).toHaveLength(1);
    await act(async () => { finish(""); });
    expect(screen.getByRole("button", { name: "チェック実行" })).toBeEnabled();
  });

  it("部分失敗は完了通知にせず、検査設定の変更時は再チェックを案内する", async () => {
    mockEvalTS.mockResolvedValue({ results: [{ severity: "INFO", messageKey: "CHECK_FAILED", message: "check failed" }], scopeInfo: mockScopeInfo });
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "チェック実行" })); });
    expect(screen.getByText(/一部の検査を完了できませんでした/)).toBeInTheDocument();
    openSettings();
    fireEvent.click(screen.getByRole("checkbox", { name: /大判印刷モード/ }));
    expect(screen.getByText(/条件が変わりました/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /大判印刷モード/ }));
    expect(screen.queryByText(/条件が変わりました/)).not.toBeInTheDocument();
  });
});

describe("パネルの構成（v1.1.2）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("設定を開くと結果の代わりに設定が表示され、もう一度押すと結果に戻る", async () => {
    mockEvalTS.mockResolvedValue({ results: [{ severity: "ERROR", messageKey: "e1", message: "エラーが発生しました" }], scopeInfo: mockScopeInfo });
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "チェック実行" })); });
    expect(screen.getByRole("button", { name: /エラーが発生しました/ })).toBeInTheDocument();

    const settingsButton = screen.getByRole("button", { name: "設定" });
    fireEvent.click(settingsButton);
    expect(settingsButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "設定" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /エラーが発生しました/ })).not.toBeInTheDocument();

    fireEvent.click(settingsButton);
    expect(screen.queryByRole("region", { name: "設定" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /エラーが発生しました/ })).toBeInTheDocument();
  });

  it("判定に効く設定と効かない設定を見出しで区別する", () => {
    render(<App />);
    openSettings();
    const region = screen.getByRole("region", { name: "設定" });
    expect(region).toHaveTextContent("入稿条件");
    expect(region).toHaveTextContent("検出対象");
    expect(region).toHaveTextContent("操作");
    expect(screen.getAllByText("次のチェックから反映")).toHaveLength(2);
  });

  it("大判印刷モードを有効にするとヘッダーの入稿条件にも表示される", () => {
    render(<App />);
    expect(screen.queryByText("大判")).not.toBeInTheDocument();
    openSettings();
    fireEvent.click(screen.getByRole("checkbox", { name: /大判印刷モード/ }));
    expect(screen.getByText("大判")).toBeInTheDocument();
  });

  it("重要度別の件数は絞り込みボタンにだけ表示し、完了通知で繰り返さない", async () => {
    mockEvalTS.mockResolvedValue({ results: [
      { severity: "ERROR", messageKey: "e1", message: "エラーが発生しました" },
      { severity: "WARNING", messageKey: "w1", message: "警告があります" },
    ], scopeInfo: mockScopeInfo });
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "チェック実行" })); });
    expect(screen.queryByText(/検出: 2件/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("検出サマリー")).not.toBeInTheDocument();
    const severityGroup = screen.getByRole("group", { name: "重要度で絞り込む" });
    expect(within(severityGroup).getByRole("button", { name: /要修正/ })).toHaveTextContent("1");
  });

  it("Illustrator の UI の明るさをパネルのテーマに反映する", () => {
    const original = (window as any).__adobe_cep__;
    (window as any).__adobe_cep__ = {
      getHostEnvironment: () => JSON.stringify({ appSkinInfo: { panelBackgroundColor: { color: { red: 240, green: 240, blue: 240 } } } }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    try {
      render(<App />);
      expect(document.documentElement.dataset.theme).toBe("lightest");
    } finally {
      (window as any).__adobe_cep__ = original;
    }
  });
});

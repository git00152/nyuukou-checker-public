import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PreviewViewport } from "../../src/js/main/components/PreviewViewport";
import type { CheckResult, ScopeInfo } from "../../src/jsx/hostscript/types";

const SCOPE_INFO: ScopeInfo = {
  bounds: [0, 297, 210, 0],
  hasIncompleteMarks: false,
};

describe("PreviewViewport", () => {
  it("ズームイン、ズームアウト、100% リセットができる", () => {
    render(
      <PreviewViewport
        scopeInfo={SCOPE_INFO}
        results={[]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        status="done"
      />
    );

    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "縮小" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    fireEvent.click(screen.getByRole("button", { name: "100%に戻す" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("キーボードでズームとパンを操作できる", () => {
    render(
      <PreviewViewport
        scopeInfo={SCOPE_INFO}
        results={[]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        status="done"
      />
    );

    const scrollArea = screen.getByTestId("preview-scroll-area");
    fireEvent.keyDown(scrollArea, { key: "+" });
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.keyDown(scrollArea, { key: "-" });
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.keyDown(scrollArea, { key: "ArrowRight" });
    expect(scrollArea.scrollLeft).toBe(48);
    fireEvent.keyDown(scrollArea, { key: "ArrowDown" });
    expect(scrollArea.scrollTop).toBe(48);
    fireEvent.keyDown(scrollArea, { key: "0" });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("選択中の検出項目へスクロールできる", () => {
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー1",
        bounds: [175, 80, 205, 20],
      },
    ];
    render(
      <PreviewViewport
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
        status="done"
      />
    );

    const scrollArea = screen.getByTestId("preview-scroll-area");
    fireEvent.click(screen.getByRole("button", { name: "選択項目へ移動" }));

    expect(scrollArea.scrollTop).toBeGreaterThan(0);
  });

  it("scopeInfo が null でもクラッシュせずツールバーを表示する", () => {
    render(
      <PreviewViewport
        scopeInfo={null}
        results={[]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        status="idle"
      />
    );

    expect(screen.getByRole("button", { name: "拡大" })).toBeInTheDocument();
    expect(screen.getByText(/アートボード|情報なし/)).toBeInTheDocument();
  });
});

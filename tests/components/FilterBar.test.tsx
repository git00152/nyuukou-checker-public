import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FilterBar } from "../../src/js/main/components/FilterBar";
import type { CheckResult } from "../../src/jsx/hostscript/types";

type Severity = "ERROR" | "WARNING" | "INFO";

// ERROR x3, WARNING x2, INFO x1 のサンプル results
function makeResults(): CheckResult[] {
  return [
    { severity: "ERROR", messageKey: "e1", message: "エラー1" },
    { severity: "ERROR", messageKey: "e2", message: "エラー2" },
    { severity: "ERROR", messageKey: "e3", message: "エラー3" },
    { severity: "WARNING", messageKey: "w1", message: "警告1" },
    { severity: "WARNING", messageKey: "w2", message: "警告2" },
    { severity: "INFO", messageKey: "i1", message: "情報1" },
  ];
}

describe("FilterBar", () => {
  it("Test 1: ERROR(3)/WARNING(2)/INFO(1) の results が渡されると各ボタンに件数バッジが表示される", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR", "WARNING", "INFO"]);
    render(
      <FilterBar
        results={makeResults()}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    // ボタンの textContent（ERROR3, WARNING2, INFO1）を確認
    const errorBtn = screen.getByRole("button", { name: /ERROR/ });
    const warningBtn = screen.getByRole("button", { name: /WARNING/ });
    const infoBtn = screen.getByRole("button", { name: /INFO/ });
    expect(errorBtn.textContent).toMatch(/3/);
    expect(warningBtn.textContent).toMatch(/2/);
    expect(infoBtn.textContent).toMatch(/1/);
  });

  it("Test 2: activeFilters に ERROR が含まれる場合、ERROR ボタンが active スタイルで表示される", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR"]);
    render(
      <FilterBar
        results={makeResults()}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    // aria-pressed="true" で active 状態を確認
    const errorButton = screen.getByRole("button", { name: /ERROR/ });
    expect(errorButton).toHaveAttribute("aria-pressed", "true");
  });

  it("Test 3: activeFilters に ERROR が含まれない場合、ERROR ボタンが inactive スタイルで表示される", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["WARNING", "INFO"]);
    render(
      <FilterBar
        results={makeResults()}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    const errorButton = screen.getByRole("button", { name: /ERROR/ });
    expect(errorButton).toHaveAttribute("aria-pressed", "false");
  });

  it("Test 4: ERROR ボタンクリックで selection handler に 'ERROR' が渡される", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR", "WARNING", "INFO"]);
    render(
      <FilterBar
        results={makeResults()}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    const errorButton = screen.getByRole("button", { name: /ERROR/ });
    fireEvent.click(errorButton);
    expect(onSelectSeverityFilter).toHaveBeenCalledWith("ERROR");
  });

  it("Test 5: WARNING ボタンクリックで selection handler に 'WARNING' が渡される", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR", "WARNING", "INFO"]);
    render(
      <FilterBar
        results={makeResults()}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    const warningButton = screen.getByRole("button", { name: /WARNING/ });
    fireEvent.click(warningButton);
    expect(onSelectSeverityFilter).toHaveBeenCalledWith("WARNING");
  });

  it("Test 6: INFO ボタンクリックで selection handler に 'INFO' が渡される", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR", "WARNING", "INFO"]);
    render(
      <FilterBar
        results={makeResults()}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    const infoButton = screen.getByRole("button", { name: /INFO/ });
    fireEvent.click(infoButton);
    expect(onSelectSeverityFilter).toHaveBeenCalledWith("INFO");
  });

  it("Test 7: results が空配列の場合、各ボタンが 0 件を表示する", () => {
    const onSelectSeverityFilter = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR", "WARNING", "INFO"]);
    render(
      <FilterBar
        results={[]}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
      />
    );
    // 各ボタンが 0 件を含む
    const buttons = screen.getAllByRole("button");
    const allText = buttons.map((b) => b.textContent).join(" ");
    // 少なくとも 3 つの "0" が含まれる (ERROR:0, WARNING:0, INFO:0)
    const zeroMatches = allText.match(/0/g);
    expect(zeroMatches?.length).toBeGreaterThanOrEqual(3);
  });

  it("messageKey 詳細フィルタは results に出現したキーだけを表示し、切り替えハンドラを呼ぶ", () => {
    const onSelectSeverityFilter = vi.fn();
    const onToggleMessageKey = vi.fn();
    const activeFilters = new Set<Severity>(["ERROR", "WARNING", "INFO"]);
    render(
      <FilterBar
        results={[
          { severity: "ERROR", messageKey: "PATH_THIN_LINE_01", message: "細線" },
          { severity: "ERROR", messageKey: "PATH_THIN_LINE_01", message: "細線 2" },
          { severity: "INFO", messageKey: "UNKNOWN_KEY", message: "未知" },
        ]}
        activeFilters={activeFilters}
        onSelectSeverityFilter={onSelectSeverityFilter}
        activeMessageKeys={new Set(["PATH_THIN_LINE_01", "UNKNOWN_KEY"])}
        onToggleMessageKey={onToggleMessageKey}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "フィルタ詳細" }));
    expect(screen.getByLabelText(/0.28pt未満の細線が検出されました/)).toBeInTheDocument();
    expect(screen.getByLabelText(/UNKNOWN_KEY/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/0.28pt未満の細線が検出されました/));
    expect(onToggleMessageKey).toHaveBeenCalledWith("PATH_THIN_LINE_01");
  });
});

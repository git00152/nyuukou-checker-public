import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SVGPreview } from "../../src/js/main/components/SVGPreview";
import type { CheckResult, ScopeInfo } from "../../src/jsx/hostscript/types";

// scopeToViewBox の実際の戻り値と一致させるためのヘルパー
// scopeToViewBox([0, 297, 210, 0]) => "0 0 210 297"
const SCOPE: [number, number, number, number] = [0, 297, 210, 0];
const SCOPE_INFO: ScopeInfo = { bounds: SCOPE, hasIncompleteMarks: false };

describe("SVGPreview", () => {
  it("Test 1: scopeInfo が null の場合、プレースホルダーを表示し SVG を描画しない", () => {
    const onSelectIndex = vi.fn();
    render(
      <SVGPreview
        scopeInfo={null}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="idle"
      />
    );
    // SVG が描画されないことを確認
    expect(document.querySelector("svg")).toBeNull();
    // プレースホルダーメッセージが表示されていることを確認
    expect(screen.getByText(/アートボード|スコープ未取得|情報なし/)).toBeInTheDocument();
  });

  it("Test 2: status === 'checking' の場合、スピナーが表示される", () => {
    const onSelectIndex = vi.fn();
    render(
      <SVGPreview
        scopeInfo={null}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="checking"
      />
    );
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("Test 3: 有効な scopeInfo が渡されると SVG が描画され viewBox が正しい", () => {
    const onSelectIndex = vi.fn();
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    // scopeToViewBox([0, 297, 210, 0]) => "0 0 210 297"
    expect(svg?.getAttribute("viewBox")).toBe("0 0 210 297");
  });

  it("Test 4: bounds を持つ ERROR の CheckResult が overlay-rect として描画される", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー",
        bounds: [10, 200, 60, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rects = document.querySelectorAll("[data-testid='overlay-rect']");
    expect(rects.length).toBe(1);
  });

  it("Test 5: ERROR の rect は stroke が赤系カラー (#e53e3e) で描画される", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー",
        bounds: [10, 200, 60, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rect = document.querySelector("[data-testid='overlay-rect']");
    expect(rect?.getAttribute("stroke")).toBe("#e53e3e");
  });

  it("Test 6: WARNING は黄系 (#d69e2e)、INFO は青系 (#3182ce) で描画される", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "WARNING",
        messageKey: "w1",
        message: "警告",
        bounds: [10, 200, 60, 150],
      },
      {
        severity: "INFO",
        messageKey: "i1",
        message: "情報",
        bounds: [70, 200, 120, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rects = document.querySelectorAll("[data-testid='overlay-rect']");
    expect(rects[0]?.getAttribute("stroke")).toBe("#d69e2e");
    expect(rects[1]?.getAttribute("stroke")).toBe("#3182ce");
  });

  it("Test 7: selectedIndex === 0 の場合、最初の rect が data-selected='true' で strokeWidth が大きい", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー",
        bounds: [10, 200, 60, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={0}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rect = document.querySelector("[data-testid='overlay-rect']");
    expect(rect?.getAttribute("data-selected")).toBe("true");
    const strokeWidth = parseFloat(rect?.getAttribute("stroke-width") ?? "0");
    expect(strokeWidth).toBeGreaterThan(1);
  });

  it("Test 8: 非選択の rect は opacity が 0.3 になる（選択項目が存在する場合）", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー1",
        bounds: [10, 200, 60, 150],
      },
      {
        severity: "WARNING",
        messageKey: "w1",
        message: "警告1",
        bounds: [70, 200, 120, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={0}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rects = document.querySelectorAll("[data-testid='overlay-rect']");
    // 非選択の2番目の rect の opacity が 0.3
    expect(rects[1]?.getAttribute("opacity")).toBe("0.3");
  });

  it("Test 9: bounds を持たない CheckResult は rect を描画しない", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "boundsなしエラー",
        // bounds なし
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rects = document.querySelectorAll("[data-testid='overlay-rect']");
    expect(rects.length).toBe(0);
  });

  it("Test 11: bounds が [0,0,0,0] の ScopeInfo でも DEBUG テキストが描画されない（gap closure 検証）", () => {
    const zeroBoundsScopeInfo: ScopeInfo = { bounds: [0, 0, 0, 0], hasIncompleteMarks: false };
    const onSelectIndex = vi.fn();
    render(
      <SVGPreview
        scopeInfo={zeroBoundsScopeInfo}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    expect(screen.queryByText(/DEBUG/)).toBeNull();
  });

  it("Test 12: previewDataUrl を渡すと <image> 要素がアートボード背景として描画される", () => {
    const onSelectIndex = vi.fn();
    const dataUrl = "data:image/png;base64,abc123";
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
        previewDataUrl={dataUrl}
      />
    );
    const img = document.querySelector("[data-testid='preview-image']");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("href")).toBe(dataUrl);
  });

  it("Test 13: previewDataUrl が null の場合は <image> 要素が描画されない", () => {
    const onSelectIndex = vi.fn();
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
        previewDataUrl={null}
      />
    );
    const img = document.querySelector("[data-testid='preview-image']");
    expect(img).toBeNull();
  });

  it("Test 14: <image> の x/y/width/height がアートボード bounds と一致する", () => {
    // SCOPE = [0, 297, 210, 0] → x=0, y=0, width=210, height=297
    const onSelectIndex = vi.fn();
    const dataUrl = "data:image/png;base64,abc123";
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={[]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
        previewDataUrl={dataUrl}
      />
    );
    const img = document.querySelector("[data-testid='preview-image']");
    // bounds [0, 297, 210, 0]: x=bounds[0]=0, y=bounds[3]=0, w=bounds[2]-bounds[0]=210, h=bounds[1]-bounds[3]=297
    expect(img?.getAttribute("x")).toBe("0");
    expect(img?.getAttribute("y")).toBe("0");
    expect(img?.getAttribute("width")).toBe("210");
    expect(img?.getAttribute("height")).toBe("297");
  });

  it("Test 15: bounds を持つ結果に表示順の 1-based overlay label が描画される", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー1",
        bounds: [10, 200, 60, 150],
      },
      {
        severity: "WARNING",
        messageKey: "w1",
        message: "警告1",
        bounds: [70, 200, 120, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );

    const labels = screen.getAllByTestId("overlay-label");
    expect(labels.map((label) => label.textContent)).toEqual(["1", "2"]);
  });

  it("Test 16: bounds がない結果を飛ばしても overlay label はフィルタ済み結果順の番号を保つ", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "bounds あり",
        bounds: [10, 200, 60, 150],
      },
      {
        severity: "WARNING",
        messageKey: "w1",
        message: "bounds なし",
      },
      {
        severity: "INFO",
        messageKey: "i1",
        message: "bounds あり",
        bounds: [70, 200, 120, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );

    const labels = screen.getAllByTestId("overlay-label");
    expect(labels.map((label) => label.textContent)).toEqual(["1", "3"]);
  });

  it("Test 17: 選択 overlay は非選択 overlay より stroke と fill が強く label 背景も濃い", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー1",
        bounds: [10, 200, 60, 150],
      },
      {
        severity: "WARNING",
        messageKey: "w1",
        message: "警告1",
        bounds: [70, 200, 120, 150],
      },
    ];
    render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={0}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );

    const rects = screen.getAllByTestId("overlay-rect");
    const labelBackgrounds = screen.getAllByTestId("overlay-label-background");

    expect(parseFloat(rects[0].getAttribute("stroke-width") ?? "0")).toBeGreaterThan(
      parseFloat(rects[1].getAttribute("stroke-width") ?? "0")
    );
    expect(parseFloat(rects[0].getAttribute("fill-opacity") ?? "0")).toBeGreaterThan(
      parseFloat(rects[1].getAttribute("fill-opacity") ?? "0")
    );
    expect(parseFloat(labelBackgrounds[0].getAttribute("fill-opacity") ?? "0")).toBeGreaterThan(
      parseFloat(labelBackgrounds[1].getAttribute("fill-opacity") ?? "0")
    );
  });

  it("Test 10: rect クリックで onSelectIndex が呼ばれる（同一インデックス再クリックで null を渡す）", () => {
    const onSelectIndex = vi.fn();
    const results: CheckResult[] = [
      {
        severity: "ERROR",
        messageKey: "e1",
        message: "エラー",
        bounds: [10, 200, 60, 150],
      },
    ];
    // 初回クリック: 非選択 → index 0 を選択
    const { rerender } = render(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rect = document.querySelector("[data-testid='overlay-rect']");
    fireEvent.click(rect!);
    expect(onSelectIndex).toHaveBeenCalledWith(0);

    // 同一インデックスを再クリック → null を渡す
    onSelectIndex.mockClear();
    rerender(
      <SVGPreview
        scopeInfo={SCOPE_INFO}
        results={results}
        selectedIndex={0}
        onSelectIndex={onSelectIndex}
        status="done"
      />
    );
    const rect2 = document.querySelector("[data-testid='overlay-rect']");
    fireEvent.click(rect2!);
    expect(onSelectIndex).toHaveBeenCalledWith(null);
  });
});

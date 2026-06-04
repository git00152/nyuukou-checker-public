import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultList } from "../../src/js/main/components/ResultList";
import type { CheckResult } from "../../src/jsx/hostscript/types";

// messages.ts をモック（テスト専用の確定値を返す）
vi.mock("../../src/js/main/data/messages", () => ({
  getMessageDetail: (key: string) => ({
    problem: `問題テキスト:${key}`,
    impact: `影響テキスト:${key}`,
    hint: `ヒントテキスト:${key}`,
  }),
}));

const makeResult = (
  severity: CheckResult["severity"],
  messageKey: string,
  overrides?: Partial<CheckResult>
): CheckResult => ({
  severity,
  messageKey,
  message: `${severity} メッセージ ${messageKey}`,
  ...overrides,
});

describe("ResultList", () => {
  // Test 1: 空状態メッセージ
  it("Test 1: hasScanned=true かつ results が空の場合「問題は検出されませんでした」を表示する", () => {
    render(
      <ResultList results={[]} selectedIndex={null} onSelectIndex={vi.fn()} hasScanned={true} />
    );
    expect(screen.getByText(/問題は検出されませんでした/)).toBeInTheDocument();
  });

  it("Test 1b: hasScanned=false の場合は何も表示しない", () => {
    const { container } = render(
      <ResultList results={[]} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  // Test 2: ERROR 色分け
  it("Test 2: ERROR の項目が data-severity=\"ERROR\" 属性で識別される", () => {
    const results = [makeResult("ERROR", "err.01")];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ err\.01/ }));
    const li = document.querySelector('[data-severity="ERROR"]');
    expect(li).not.toBeNull();
  });

  // Test 3: WARNING / INFO 色分け
  it("Test 3: WARNING と INFO の項目がそれぞれ data-severity 属性で識別される", () => {
    const results = [
      makeResult("WARNING", "warn.01"),
      makeResult("INFO", "info.01"),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /WARNING メッセージ warn\.01/ }));
    fireEvent.click(screen.getByRole("button", { name: /INFO メッセージ info\.01/ }));
    expect(document.querySelector('[data-severity="WARNING"]')).not.toBeNull();
    expect(document.querySelector('[data-severity="INFO"]')).not.toBeNull();
  });

  // Test 4: クリックでアコーディオンが展開する
  it("Test 4: グループを開いてから項目クリックでアコーディオンが展開し「問題:」「印刷への影響:」「改善ヒント:」が表示される", () => {
    const results = [makeResult("ERROR", "err.01")];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    // 展開前は詳細が非表示
    expect(screen.queryByText(/^問題:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ err\.01/ }));

    // 項目をクリック
    const li = document.querySelector('[data-severity="ERROR"]') as HTMLElement;
    fireEvent.click(li);

    expect(screen.getByText(/^問題:/)).toBeInTheDocument();
    expect(screen.getByText(/^印刷への影響:/)).toBeInTheDocument();
    expect(screen.getByText(/^改善ヒント:/)).toBeInTheDocument();
  });

  // Test 5: 再クリックでアコーディオンが閉じる
  it("Test 5: 同じ項目を再クリックするとアコーディオンが閉じる", () => {
    const results = [makeResult("ERROR", "err.01")];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ err\.01/ }));
    const li = document.querySelector('[data-severity="ERROR"]') as HTMLElement;
    fireEvent.click(li); // 開く
    expect(screen.getByText(/^問題:/)).toBeInTheDocument();

    fireEvent.click(li); // 閉じる
    expect(screen.queryByText(/^問題:/)).not.toBeInTheDocument();
  });

  // Test 6: 排他的展開
  it("Test 6: 別の項目をクリックすると前の展開が閉じ新しい項目が展開する", () => {
    const results = [
      makeResult("ERROR", "err.01"),
      makeResult("WARNING", "warn.01"),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ err\.01/ }));
    fireEvent.click(screen.getByRole("button", { name: /WARNING メッセージ warn\.01/ }));

    const [firstLi, secondLi] = document.querySelectorAll("li[data-severity]");

    fireEvent.click(firstLi as HTMLElement); // 最初を展開
    expect(screen.getAllByText(/^問題:/).length).toBe(1);

    fireEvent.click(secondLi as HTMLElement); // 次を展開 → 最初が閉じる
    // 詳細エリアは1つだけ表示される
    expect(screen.getAllByText(/^問題:/).length).toBe(1);
    // 2番目の messageKey に紐づく詳細が表示されること
    expect(screen.getByText(/ヒントテキスト:warn\.01/)).toBeInTheDocument();
  });

  // Test 7: onSelectIndex の呼び出し
  it("Test 7: 項目クリックで onSelectIndex が呼ばれる（展開時はインデックス、閉じる時は null）", () => {
    const onSelectIndex = vi.fn();
    const results = [makeResult("ERROR", "err.01")];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={onSelectIndex} />
    );
    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ err\.01/ }));
    const li = document.querySelector('[data-severity="ERROR"]') as HTMLElement;

    fireEvent.click(li); // 展開
    expect(onSelectIndex).toHaveBeenLastCalledWith(0);

    fireEvent.click(li); // 閉じる
    expect(onSelectIndex).toHaveBeenLastCalledWith(null);
  });

  // Test 8: selectedIndex と expandedIndex の同期
  it("Test 8: 外部から selectedIndex が変更されるとアコーディオンが開く", () => {
    const results = [
      makeResult("ERROR", "err.01"),
      makeResult("WARNING", "warn.01"),
    ];
    const { rerender } = render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    expect(screen.queryByText(/^問題:/)).not.toBeInTheDocument();

    // 外部から selectedIndex=1 を注入
    rerender(
      <ResultList results={results} selectedIndex={1} onSelectIndex={vi.fn()} />
    );
    expect(screen.getByText(/ヒントテキスト:warn\.01/)).toBeInTheDocument();
  });

  // Test 9: objectName の表示
  it("Test 9: objectName が存在する場合、項目にオブジェクト名が表示される", () => {
    const results = [
      makeResult("ERROR", "err.01", { objectName: "レイヤー1/rect01" }),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ err\.01/ }));
    expect(screen.getByText(/レイヤー1\/rect01/)).toBeInTheDocument();
  });

  // Test 10: 小フォント・折り返し style
  it("Test 10: 180px 幅前提のリストに wordBreak と fontSize スタイルが適用される", () => {
    const results = [makeResult("INFO", "info.01")];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    const ul = document.querySelector("ul");
    expect(ul).not.toBeNull();
    expect(ul!.style.wordBreak).toBe("break-word");
    expect(ul!.style.fontSize).toBe("12px");
  });

  it("Test 11: 表示順に 1-based の番号バッジが表示される", () => {
    const results = [
      makeResult("ERROR", "err.01"),
      makeResult("WARNING", "warn.01"),
      makeResult("INFO", "info.01"),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    for (const header of screen.getAllByRole("button")) {
      fireEvent.click(header);
    }

    const badges = screen.getAllByTestId("result-number");
    expect(badges.map((badge) => badge.textContent)).toEqual(["1", "2", "3"]);
  });

  it("Test 12: bounds がない結果を含んでもリスト番号は連続する", () => {
    const results = [
      makeResult("ERROR", "err.01", { bounds: [0, 10, 10, 0] }),
      makeResult("WARNING", "warn.01"),
      makeResult("INFO", "info.01", { bounds: [20, 30, 30, 20] }),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );
    for (const header of screen.getAllByRole("button")) {
      fireEvent.click(header);
    }

    const badges = screen.getAllByTestId("result-number");
    expect(badges.map((badge) => badge.textContent)).toEqual(["1", "2", "3"]);
  });

  it("Test 13: 同じ messageKey の結果は 1 つのグループにまとまる", () => {
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
      makeResult("WARNING", "warn.other", { message: "別の検出" }),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );

    expect(screen.getAllByTestId("result-group")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /同じ検出 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /別の検出/ })).toBeInTheDocument();
  });

  it("Test 14: グループヘッダーに severity と件数が表示される", () => {
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );

    const groupHeader = screen.getByRole("button", { name: /同じ検出 1/ });
    expect(groupHeader).toHaveTextContent("ERROR");
    expect(groupHeader).toHaveTextContent("2");
  });

  it("Test 15: グループは閉じて再度開ける", () => {
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
    ];
    render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );

    const groupHeader = screen.getByRole("button", { name: /同じ検出 1/ });
    expect(groupHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByTestId("result-number")).toHaveLength(0);

    fireEvent.click(groupHeader);
    expect(screen.getAllByTestId("result-number").map((badge) => badge.textContent)).toEqual(["1", "2"]);

    fireEvent.click(groupHeader);
    expect(screen.queryAllByTestId("result-number")).toHaveLength(0);
  });

  it("Test 16: 選択中の項目を含むグループを閉じると onSelectIndex(null) が呼ばれる", () => {
    const onSelectIndex = vi.fn();
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
      makeResult("WARNING", "warn.other", { message: "別の検出" }),
    ];
    render(
      <ResultList results={results} selectedIndex={1} onSelectIndex={onSelectIndex} />
    );

    fireEvent.click(screen.getByRole("button", { name: /同じ検出 1/ }));
    expect(onSelectIndex).toHaveBeenCalledWith(null);
  });

  it("Test 17: 閉じたグループは同じ結果セットの再描画後も閉じたまま維持される", () => {
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
      makeResult("WARNING", "warn.other", { message: "別の検出" }),
    ];
    const { rerender } = render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={vi.fn()} />
    );

    expect(screen.queryByText("同じ検出 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /別の検出/ })).toBeInTheDocument();

    rerender(
      <ResultList results={[...results]} selectedIndex={2} onSelectIndex={vi.fn()} />
    );

    expect(screen.queryByText("同じ検出 2")).not.toBeInTheDocument();
    expect(screen.getAllByText("別の検出").length).toBeGreaterThan(0);
  });

  it("Test 18: 閉じたグループは別グループ内の結果クリック後も閉じたまま維持される", () => {
    const onSelectIndex = vi.fn();
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
      makeResult("WARNING", "warn.other", { message: "別の検出" }),
    ];
    const { rerender } = render(
      <ResultList results={results} selectedIndex={null} onSelectIndex={onSelectIndex} />
    );

    expect(screen.queryByText("同じ検出 2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /別の検出/ }));
    fireEvent.click(document.querySelector('[data-severity="WARNING"]') as HTMLElement);
    expect(onSelectIndex).toHaveBeenLastCalledWith(2);

    rerender(
      <ResultList results={[...results]} selectedIndex={2} onSelectIndex={onSelectIndex} />
    );

    expect(screen.queryByText("同じ検出 2")).not.toBeInTheDocument();
    expect(screen.getByText(/ヒントテキスト:warn\.other/)).toBeInTheDocument();
  });

  it("Test 19: 親が選択状態を更新して新しい results 配列を渡しても閉じたグループは開かない", () => {
    const results = [
      makeResult("ERROR", "err.same", { message: "同じ検出 1" }),
      makeResult("ERROR", "err.same", { message: "同じ検出 2" }),
      makeResult("WARNING", "warn.other", { message: "別の検出" }),
    ];

    const Harness: React.FC = () => {
      const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
      return (
        <ResultList
          results={[...results]}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
        />
      );
    };

    render(<Harness />);

    expect(screen.queryByText("同じ検出 2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /別の検出/ }));
    fireEvent.click(document.querySelector('[data-severity="WARNING"]') as HTMLElement);

    expect(screen.queryByText("同じ検出 2")).not.toBeInTheDocument();
    expect(screen.getByText(/ヒントテキスト:warn\.other/)).toBeInTheDocument();
  });

  it("targetRef actions がある項目に選択・削除ボタンを表示し、項目開閉を暴発させない", () => {
    const onSelectTarget = vi.fn();
    const onDeleteTarget = vi.fn();
    const onSelectIndex = vi.fn();
    const result = makeResult("WARNING", "PATH_STRAY_01", {
      targetRef: { kind: "pathItem", messageKey: "PATH_STRAY_01" },
      actions: [
        { id: "select", label: "編集画面で選択" },
        { id: "delete", label: "削除", destructive: true },
      ],
    });
    render(
      <ResultList
        results={[result]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        onSelectTarget={onSelectTarget}
        onDeleteTarget={onDeleteTarget}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /WARNING メッセージ PATH_STRAY_01/ }));
    fireEvent.click(screen.getByRole("button", { name: "編集画面で選択" }));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(onSelectTarget).toHaveBeenCalledWith(result);
    expect(onDeleteTarget).toHaveBeenCalledWith(result);
    expect(onSelectIndex).not.toHaveBeenCalled();
  });

  it("select action がなくても pathItem targetRef があれば選択ボタンを表示する", () => {
    const onSelectTarget = vi.fn();
    const onSelectIndex = vi.fn();
    const result = makeResult("WARNING", "ANY_PATH_RESULT", {
      targetRef: { kind: "pathItem", messageKey: "ANY_PATH_RESULT" },
      actions: [],
    });
    render(
      <ResultList
        results={[result]}
        selectedIndex={null}
        onSelectIndex={onSelectIndex}
        onSelectTarget={onSelectTarget}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /WARNING メッセージ ANY_PATH_RESULT/ }));
    fireEvent.click(screen.getByRole("button", { name: "編集画面で選択" }));

    expect(onSelectTarget).toHaveBeenCalledWith(result);
    expect(onSelectIndex).not.toHaveBeenCalled();
  });

  it("pathItem 以外の targetRef だけでは選択ボタンを表示しない", () => {
    const result = makeResult("INFO", "COLOR_UNUSED_SWATCH_01", {
      targetRef: { kind: "swatch", messageKey: "COLOR_UNUSED_SWATCH_01", swatchName: "Spot" },
      actions: [],
    });
    render(
      <ResultList
        results={[result]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        onSelectTarget={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /INFO メッセージ COLOR_UNUSED_SWATCH_01/ }));

    expect(screen.queryByRole("button", { name: "編集画面で選択" })).not.toBeInTheDocument();
  });

  it("textFrame targetRef があれば選択ボタンを表示する", () => {
    const onSelectTarget = vi.fn();
    const result = makeResult("ERROR", "TEXT_LIVE_01", {
      targetRef: { kind: "textFrame", messageKey: "TEXT_LIVE_01", objectName: "live-text" },
      actions: [],
    });
    render(
      <ResultList
        results={[result]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        onSelectTarget={onSelectTarget}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ TEXT_LIVE_01/ }));
    fireEvent.click(screen.getByRole("button", { name: "編集画面で選択" }));

    expect(onSelectTarget).toHaveBeenCalledWith(result);
  });

  it("画像 targetRef があれば選択ボタンを表示する", () => {
    const onSelectTarget = vi.fn();
    const result = makeResult("ERROR", "IMG_RESOLUTION_LOW_01", {
      targetRef: { kind: "placedItem", messageKey: "IMG_RESOLUTION_LOW_01", objectName: "image.psd" },
      actions: [],
    });
    render(
      <ResultList
        results={[result]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        onSelectTarget={onSelectTarget}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ERROR メッセージ IMG_RESOLUTION_LOW_01/ }));
    fireEvent.click(screen.getByRole("button", { name: "編集画面で選択" }));

    expect(onSelectTarget).toHaveBeenCalledWith(result);
  });

  it("cleanup action があるグループに一括削除ボタンを表示する", () => {
    const onCleanupTargets = vi.fn();
    const result = makeResult("INFO", "COLOR_UNUSED_SWATCH_01", {
      targetRef: { kind: "swatch", messageKey: "COLOR_UNUSED_SWATCH_01", swatchName: "Spot" },
      actions: [
        { id: "delete", label: "削除", destructive: true },
        { id: "cleanup", label: "この項目をすべて削除", destructive: true },
      ],
    });
    render(
      <ResultList
        results={[result]}
        selectedIndex={null}
        onSelectIndex={vi.fn()}
        onCleanupTargets={onCleanupTargets}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /INFO メッセージ COLOR_UNUSED_SWATCH_01/ }));
    fireEvent.click(screen.getByRole("button", { name: "この項目をすべて削除" }));

    expect(onCleanupTargets).toHaveBeenCalledWith("COLOR_UNUSED_SWATCH_01", [result]);
  });
});

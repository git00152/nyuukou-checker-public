import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  IssueFilterPanel,
  createMessageKeyFilterItems,
} from "../../src/js/main/components/IssueFilterPanel";
import type { CheckResult } from "../../src/jsx/hostscript/types";

describe("IssueFilterPanel", () => {
  it("results から messageKey 単位の表示項目を生成する", () => {
    const results: CheckResult[] = [
      { severity: "WARNING", messageKey: "PATH_EMPTY_01", message: "empty" },
      { severity: "WARNING", messageKey: "PATH_EMPTY_01", message: "empty" },
      { severity: "INFO", messageKey: "UNKNOWN_KEY", message: "unknown" },
    ];

    const items = createMessageKeyFilterItems(results);

    expect(items).toEqual([
      expect.objectContaining({ key: "PATH_EMPTY_01", count: 2 }),
      expect.objectContaining({ key: "UNKNOWN_KEY", count: 1, label: "UNKNOWN_KEY" }),
    ]);
  });

  it("チェックボックス操作で該当 messageKey を通知する", () => {
    const onToggle = vi.fn();
    render(
      <IssueFilterPanel
        items={[{ key: "PATH_EMPTY_01", count: 2, label: "空パス" }]}
        activeMessageKeys={new Set(["PATH_EMPTY_01"])}
        onToggleMessageKey={onToggle}
      />
    );

    fireEvent.click(screen.getByLabelText(/空パス/));

    expect(onToggle).toHaveBeenCalledWith("PATH_EMPTY_01");
  });
});

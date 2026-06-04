import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IssueSummary } from "../../src/js/main/components/IssueSummary";
import type { CheckResult } from "../../src/jsx/hostscript/types";

describe("IssueSummary", () => {
  it("severity ごとの件数と表示件数を表示する", () => {
    const results: CheckResult[] = [
      { severity: "ERROR", messageKey: "e1", message: "error" },
      { severity: "WARNING", messageKey: "w1", message: "warning" },
      { severity: "WARNING", messageKey: "w2", message: "warning" },
      { severity: "INFO", messageKey: "i1", message: "info" },
    ];

    render(<IssueSummary results={results} visibleCount={3} />);

    expect(screen.getByLabelText("検出サマリー")).toBeInTheDocument();
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(screen.getByText("WARNING")).toBeInTheDocument();
    expect(screen.getByText("INFO")).toBeInTheDocument();
  });
});

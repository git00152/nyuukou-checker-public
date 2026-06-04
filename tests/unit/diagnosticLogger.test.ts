import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { diagnosticLog, formatDiagnosticLogLine } from "../../src/js/main/utils/diagnosticLogger";

describe("diagnosticLogger", () => {
  const originalLogger = window.__nyuukouLog;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:00.000Z"));
    window.__nyuukouLog = vi.fn();
  });

  afterEach(() => {
    window.__nyuukouLog = originalLogger;
    vi.useRealTimers();
  });

  it("diagnosticLog は window.__nyuukouLog にイベント名と詳細を渡す", () => {
    diagnosticLog("react mount start", { phase: "startup" });

    expect(window.__nyuukouLog).toHaveBeenCalledWith("react mount start", { phase: "startup" });
  });

  it("diagnosticLog は logger 未初期化でも例外を投げない", () => {
    window.__nyuukouLog = undefined;

    expect(() => diagnosticLog("logger missing")).not.toThrow();
  });

  it("formatDiagnosticLogLine は時刻、イベント名、JSON 詳細を1行に整形する", () => {
    expect(formatDiagnosticLogLine("check done", { count: 3 })).toBe(
      "[2026-05-29T12:00:00.000Z] check done {\"count\":3}"
    );
  });
});

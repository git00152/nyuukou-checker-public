import React from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { colors, radii, severityColors, spacing } from "../styles/tokens";

const SEVERITIES: CheckResult["severity"][] = ["ERROR", "WARNING", "INFO"];

export interface IssueSummaryProps {
  results: CheckResult[];
  visibleCount: number;
}

export const IssueSummary: React.FC<IssueSummaryProps> = ({ results, visibleCount }) => {
  const counts: Record<CheckResult["severity"], number> = {
    ERROR: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const result of results) {
    counts[result.severity] += 1;
  }

  return (
    <div
      aria-label="検出サマリー"
      style={{
        display: "grid",
        gap: spacing.sm,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: colors.textMuted,
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        <span>検出サマリー</span>
        <span>{visibleCount} / {results.length}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: spacing.xs }}>
        {SEVERITIES.map((severity) => (
          <div
            key={severity}
            style={{
              minWidth: 0,
              padding: "7px 6px",
              borderRadius: radii.sm,
              border: `1px solid ${severityColors[severity]}55`,
              background: `${severityColors[severity]}1a`,
              color: severityColors[severity],
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700 }}>{severity}</div>
            <div style={{ fontSize: "16px", fontWeight: 800, lineHeight: 1.1 }}>{counts[severity]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

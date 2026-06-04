import React, { useState } from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { IssueFilterPanel, createMessageKeyFilterItems } from "./IssueFilterPanel";
import { colors, radii, severityColors, spacing } from "../styles/tokens";

type Severity = "ERROR" | "WARNING" | "INFO";

// severity カラーマップ（SVGPreview と統一）
const SEVERITY_COLOR: Record<Severity, string> = severityColors;

// severity ラベル
const SEVERITY_LABEL: Record<Severity, string> = {
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
};

const SEVERITIES: Severity[] = ["ERROR", "WARNING", "INFO"];

export interface FilterBarProps {
  results: CheckResult[];          // 全件（フィルタ前）— バッジ件数計算に使用
  activeFilters: Set<Severity>;
  onSelectSeverityFilter: (sev: Severity) => void;
  activeMessageKeys?: Set<string> | null;
  onToggleMessageKey?: (messageKey: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  results,
  activeFilters,
  onSelectSeverityFilter,
  activeMessageKeys,
  onToggleMessageKey,
}) => {
  const [detailOpen, setDetailOpen] = useState(false);
  // 件数集計
  const counts: Record<Severity, number> = {
    ERROR: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const r of results) {
    counts[r.severity] = (counts[r.severity] ?? 0) + 1;
  }
  const messageKeyCounts = createMessageKeyFilterItems(results);

  return (
    <div
      style={{
        display: "flex",
        gap: spacing.xs,
        padding: `${spacing.sm}px 0`,
        flexWrap: "wrap",
      }}
    >
      {SEVERITIES.map((sev) => {
        const isActive = activeFilters.has(sev);
        const color = SEVERITY_COLOR[sev];
        const count = counts[sev];

        return (
          <button
            key={sev}
            aria-pressed={isActive}
            onClick={() => onSelectSeverityFilter(sev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacing.xs,
              padding: "3px 8px",
              borderRadius: radii.pill,
              border: `1.5px solid ${color}`,
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: "600",
              letterSpacing: "0.02em",
              background: isActive ? color : "transparent",
              color: isActive ? "#fff" : color,
              transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
              boxShadow: isActive ? `0 0 6px ${color}66` : "none",
              outline: "none",
            }}
          >
            <span>{SEVERITY_LABEL[sev]}</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "16px",
                height: "16px",
                padding: "0 3px",
                borderRadius: radii.pill,
                background: isActive ? "rgba(255,255,255,0.25)" : color,
                color: isActive ? "#fff" : "#fff",
                fontSize: "10px",
                fontWeight: "700",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
      {onToggleMessageKey && (
        <button
          type="button"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((prev) => !prev)}
          style={{
            padding: "3px 8px",
            borderRadius: radii.pill,
            border: "1px solid rgba(226,232,240,0.35)",
            cursor: "pointer",
            fontSize: "10px",
            fontWeight: "600",
            background: detailOpen ? "rgba(226,232,240,0.18)" : "transparent",
            color: "#cbd5e1",
          }}
        >
          フィルタ詳細
        </button>
      )}
      {detailOpen && onToggleMessageKey && (
        <IssueFilterPanel
          items={messageKeyCounts}
          activeMessageKeys={activeMessageKeys}
          onToggleMessageKey={onToggleMessageKey}
        />
      )}
    </div>
  );
};

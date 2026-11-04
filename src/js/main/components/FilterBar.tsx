import React, { useState } from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { IssueFilterPanel, createMessageKeyFilterItems } from "./IssueFilterPanel";
import { SEVERITIES, SEVERITY_LABEL, type Severity } from "../data/severity";
import { SeverityMark } from "./SeverityMark";
import { PanelButton } from "./PanelButton";

export interface FilterBarProps {
  results: CheckResult[];          // 全件（フィルタ前）— 件数計算に使用
  visibleCount?: number;
  activeFilters: Set<Severity>;
  onSelectSeverityFilter: (sev: Severity) => void;
  activeMessageKeys?: Set<string> | null;
  onResetFilters?: () => void;
  onToggleMessageKey?: (messageKey: string) => void;
}

/**
 * 重要度別の件数と絞り込みを 1 行にまとめる。件数の表示はここだけにする。
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  results,
  visibleCount = results.length,
  activeFilters,
  onSelectSeverityFilter,
  activeMessageKeys,
  onToggleMessageKey,
  onResetFilters,
}) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const counts: Record<Severity, number> = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const r of results) {
    counts[r.severity] = (counts[r.severity] ?? 0) + 1;
  }
  const isFiltered = activeFilters.size < SEVERITIES.length || activeMessageKeys != null;

  return (
    <div className="filter-bar">
      <div className="filter-bar__group" role="group" aria-label="重要度で絞り込む">
        {SEVERITIES.map((sev) => (
          <button
            key={sev}
            type="button"
            className="filter-chip"
            aria-pressed={activeFilters.has(sev)}
            disabled={counts[sev] === 0}
            onClick={() => onSelectSeverityFilter(sev)}
          >
            <SeverityMark severity={sev} />
            <span>{SEVERITY_LABEL[sev]}</span>
            <span className="filter-chip__count">{counts[sev]}</span>
          </button>
        ))}
      </div>
      {isFiltered && (
        <>
          <span className="filter-bar__count">{visibleCount} / {results.length} 件</span>
          {onResetFilters && (
            <button type="button" className="link-btn" onClick={onResetFilters}>すべて表示</button>
          )}
        </>
      )}
      {onToggleMessageKey && (
        <PanelButton
          variant="quiet"
          size="small"
          className="filter-bar__more"
          aria-expanded={detailOpen}
          aria-label="検出項目で絞り込む"
          onClick={() => setDetailOpen((prev) => !prev)}
        >
          項目…
        </PanelButton>
      )}
      {detailOpen && onToggleMessageKey && (
        <IssueFilterPanel
          items={createMessageKeyFilterItems(results)}
          activeMessageKeys={activeMessageKeys}
          onToggleMessageKey={onToggleMessageKey}
        />
      )}
    </div>
  );
};

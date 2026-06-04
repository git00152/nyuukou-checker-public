import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { getMessageDetail } from "../data/messages";
import { colors, radii, shadows, severityColors, spacing } from "../styles/tokens";
import { PanelButton } from "./PanelButton";

export interface ResultListProps {
  results: CheckResult[];
  selectedIndex: number | null;
  onSelectIndex: (i: number | null) => void;
  hasScanned?: boolean;
  onSelectTarget?: (result: CheckResult) => void;
  onDeleteTarget?: (result: CheckResult) => void;
  onCleanupTargets?: (messageKey: string, results: CheckResult[]) => void;
}

interface ResultGroup {
  key: string;
  severity: CheckResult["severity"];
  message: string;
  items: Array<{
    result: CheckResult;
    index: number;
  }>;
}

// severity ごとのカードスタイル定義（通常時）
const SEVERITY_STYLE: Record<
  CheckResult["severity"],
  React.CSSProperties
> = {
  ERROR: {
    backgroundColor: "rgba(248, 113, 113, 0.10)",
    color: "#fca5a5",
    boxShadow: `${shadows.card}, inset 0 1px 0 rgba(255,255,255,0.05)`,
  },
  WARNING: {
    backgroundColor: "rgba(251, 191, 36, 0.10)",
    color: "#fcd34d",
    boxShadow: `${shadows.card}, inset 0 1px 0 rgba(255,255,255,0.05)`,
  },
  INFO: {
    backgroundColor: "rgba(96, 165, 250, 0.10)",
    color: "#93c5fd",
    boxShadow: `${shadows.card}, inset 0 1px 0 rgba(255,255,255,0.05)`,
  },
};

// severity ごとのカードスタイル定義（展開中）: 影を強めて前面に浮き上がった印象
const SEVERITY_STYLE_EXPANDED: Record<
  CheckResult["severity"],
  React.CSSProperties
> = {
  ERROR: {
    backgroundColor: "rgba(248, 113, 113, 0.22)",
    color: "#fca5a5",
    boxShadow: `${shadows.cardActive}, inset 0 1px 0 rgba(255,255,255,0.08)`,
  },
  WARNING: {
    backgroundColor: "rgba(251, 191, 36, 0.22)",
    color: "#fcd34d",
    boxShadow: `${shadows.cardActive}, inset 0 1px 0 rgba(255,255,255,0.08)`,
  },
  INFO: {
    backgroundColor: "rgba(96, 165, 250, 0.22)",
    color: "#93c5fd",
    boxShadow: `${shadows.cardActive}, inset 0 1px 0 rgba(255,255,255,0.08)`,
  },
};

const groupResults = (results: CheckResult[]): ResultGroup[] => {
  const groups: ResultGroup[] = [];
  const groupMap = new Map<string, ResultGroup>();

  results.forEach((result, index) => {
    let group = groupMap.get(result.messageKey);
    if (!group) {
      group = {
        key: result.messageKey,
        severity: result.severity,
        message: result.message,
        items: [],
      };
      groupMap.set(result.messageKey, group);
      groups.push(group);
    }
    group.items.push({ result, index });
  });

  return groups;
};

export const ResultList: React.FC<ResultListProps> = ({
  results,
  selectedIndex,
  onSelectIndex,
  hasScanned = false,
  onSelectTarget,
  onDeleteTarget,
  onCleanupTargets,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(
    () => new Set(results.map((result) => result.messageKey))
  );
  const knownGroupKeysRef = useRef<Set<string>>(
    new Set(results.map((result) => result.messageKey))
  );

  // selectedIndex の外部変化でアコーディオン同期
  useEffect(() => {
    setExpandedIndex(selectedIndex);
    if (selectedIndex !== null) {
      const selectedResult = results[selectedIndex];
      if (selectedResult) {
        setClosedGroups((prev) => {
          if (!prev.has(selectedResult.messageKey)) return prev;
          const next = new Set(prev);
          next.delete(selectedResult.messageKey);
          return next;
        });
      }
    }
  }, [selectedIndex]);

  useLayoutEffect(() => {
    setClosedGroups((prev) => {
      const currentKeys = new Set(results.map((result) => result.messageKey));
      const next = new Set(prev);
      for (const key of currentKeys) {
        if (!knownGroupKeysRef.current.has(key)) {
          next.add(key);
        }
      }
      for (const key of Array.from(next)) {
        if (!currentKeys.has(key)) {
          next.delete(key);
        }
      }
      knownGroupKeysRef.current = currentKeys;
      return next;
    });
  }, [results]);

  const handleItemClick = (index: number) => {
    const newIndex = expandedIndex === index ? null : index;
    setExpandedIndex(newIndex);
    onSelectIndex(newIndex);
  };

  const handleGroupClick = (group: ResultGroup) => {
    const isOpen = !closedGroups.has(group.key);
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (isOpen) {
        next.add(group.key);
      } else {
        next.delete(group.key);
      }
      return next;
    });

    if (isOpen && selectedIndex !== null && group.items.some((item) => item.index === selectedIndex)) {
      setExpandedIndex(null);
      onSelectIndex(null);
    }
  };

  if (results.length === 0) {
    if (!hasScanned) return null;
    return (
      <div
        style={{
          margin: spacing.sm,
          padding: "12px 14px",
          color: colors.success,
          backgroundColor: "rgba(74, 222, 128, 0.10)",
          borderRadius: radii.lg,
          fontSize: "12px",
          wordBreak: "break-word",
          boxShadow: shadows.card,
        }}
      >
        問題は検出されませんでした ✓
      </div>
    );
  }

  const groups = groupResults(results);

  const hasAction = (result: CheckResult, actionId: string) =>
    (result.actions || []).some((action) => action.id === actionId);
  const canSelectTarget = (result: CheckResult) =>
    result.targetRef?.kind === "pathItem" ||
    result.targetRef?.kind === "textFrame" ||
    result.targetRef?.kind === "placedItem" ||
    result.targetRef?.kind === "rasterItem";

  return (
    <ul
      style={{
        listStyle: "none",
        padding: spacing.sm,
        margin: 0,
        wordBreak: "break-word",
        fontSize: "12px",
      }}
    >
      {groups.map((group) => {
        const isGroupOpen = !closedGroups.has(group.key);
        const groupColor = severityColors[group.severity];

        return (
          <li
            key={group.key}
            data-testid="result-group"
            style={{
              marginBottom: spacing.md,
              listStyle: "none",
            }}
          >
            <button
              type="button"
              aria-expanded={isGroupOpen}
              onClick={() => handleGroupClick(group)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: spacing.md,
                padding: "8px 10px",
                marginBottom: isGroupOpen ? spacing.sm : 0,
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: radii.md,
                background: colors.panelBgRaised,
                color: colors.text,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  color: groupColor,
                  fontSize: "11px",
                  width: "10px",
                  flex: "0 0 auto",
                }}
              >
                {isGroupOpen ? "▼" : "▶"}
              </span>
              <span
                style={{
                  flex: "0 0 auto",
                  color: groupColor,
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                {group.severity}
              </span>
              <span
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                }}
              >
                {group.message}
              </span>
              <span
                style={{
                  flex: "0 0 auto",
                  minWidth: "24px",
                  height: "20px",
                  padding: "0 6px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {group.items.length}
              </span>
            </button>
            {isGroupOpen && group.items.some(({ result }) => hasAction(result, "cleanup")) && onCleanupTargets && (
              <div style={{ marginBottom: spacing.sm }}>
                <PanelButton
                  type="button"
                  variant="utility"
                  fullWidth
                  onClick={(event) => {
                    event.stopPropagation();
                    onCleanupTargets(
                      group.key,
                      group.items.map((item) => item.result)
                    );
                  }}
                >
                  この項目をすべて削除
                </PanelButton>
              </div>
            )}
            {isGroupOpen && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {group.items.map(({ result, index }) => {
                  const isExpanded = expandedIndex === index;
                  const detail = isExpanded ? getMessageDetail(result.messageKey) : null;
                  const severityStyle = isExpanded
                    ? SEVERITY_STYLE_EXPANDED[result.severity]
                    : SEVERITY_STYLE[result.severity];

                  return (
                    <li
                      key={index}
                      data-severity={result.severity}
                      style={{
                        marginBottom: spacing.sm,
                        cursor: "pointer",
                        borderRadius: radii.lg,
                        overflow: "hidden",
                        padding: "11px 14px",
                        ...severityStyle,
                      }}
                      onClick={() => handleItemClick(index)}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.md }}>
                        <span
                          data-testid="result-number"
                          style={{
                            flex: "0 0 auto",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "20px",
                            height: "20px",
                            padding: "0 5px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(255,255,255,0.18)",
                            color: "inherit",
                            fontSize: "11px",
                            fontWeight: 700,
                            lineHeight: 1,
                            boxSizing: "border-box",
                          }}
                        >
                          {index + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: "bold", lineHeight: "1.4" }}>
                            {result.message}
                          </div>
                          {result.objectName && (
                            <div
                              style={{
                                fontSize: "11px",
                                opacity: 0.8,
                                marginTop: "2px",
                              }}
                            >
                              {result.objectName}
                            </div>
                          )}
                          {(canSelectTarget(result) || hasAction(result, "delete")) && (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: spacing.sm,
                                marginTop: spacing.md,
                              }}
                            >
                              {canSelectTarget(result) && onSelectTarget && (
                                <PanelButton
                                  type="button"
                                  variant="utility"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectTarget(result);
                                  }}
                                >
                                  編集画面で選択
                                </PanelButton>
                              )}
                              {hasAction(result, "delete") && onDeleteTarget && (
                                <PanelButton
                                  type="button"
                                  variant="utility"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onDeleteTarget(result);
                                  }}
                                >
                                  削除
                                </PanelButton>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isExpanded && detail && (
                        <div
                          style={{
                            padding: "10px 14px",
                            fontSize: "11px",
                            lineHeight: "1.6",
                            borderTop: "1px solid rgba(255,255,255,0.12)",
                            marginTop: "8px",
                            marginLeft: "-14px",
                            marginRight: "-14px",
                            marginBottom: "-11px",
                            backgroundColor: "rgba(0, 0, 0, 0.25)",
                            color: "inherit",
                          }}
                        >
                          <p style={{ margin: "0 0 4px" }}>
                            <strong>問題:</strong> {detail.problem}
                          </p>
                          <p style={{ margin: "0 0 4px" }}>
                            <strong>印刷への影響:</strong> {detail.impact}
                          </p>
                          <p style={{ margin: 0 }}>
                            <strong>改善ヒント:</strong> {detail.hint}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};

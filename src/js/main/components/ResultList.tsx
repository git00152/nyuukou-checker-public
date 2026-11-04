import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { getMessageDetail } from "../data/messages";
import { SEVERITY_LABEL } from "../data/severity";
import { ChevronIcon } from "./icons";
import { PanelButton } from "./PanelButton";
import { SeverityMark } from "./SeverityMark";

export interface ResultListProps {
  results: CheckResult[];
  selectedIndex: number | null;
  onSelectIndex: (i: number | null) => void;
  hasScanned?: boolean;
  totalCount?: number;
  onResetFilters?: () => void;
  actionsDisabled?: boolean;
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

const hasAction = (result: CheckResult, actionId: string) =>
  (result.actions || []).some((action) => action.id === actionId);

const canSelectTarget = (result: CheckResult) =>
  result.targetRef?.kind === "pathItem" ||
  result.targetRef?.kind === "textFrame" ||
  result.targetRef?.kind === "placedItem" ||
  result.targetRef?.kind === "rasterItem";

/**
 * 検出結果をチェック種別ごとの折りたたみ行で表示する。
 * - 説明（影響・対処）はグループに 1 回だけ出す。
 * - 項目行はオブジェクト名とレイヤー名で見分ける。見出しと同じメッセージは繰り返さない。
 */
export const ResultList: React.FC<ResultListProps> = ({
  results,
  selectedIndex,
  onSelectIndex,
  hasScanned = false,
  totalCount = results.length,
  onResetFilters,
  actionsDisabled = false,
  onSelectTarget,
  onDeleteTarget,
  onCleanupTargets,
}) => {
  const [closedGroups, setClosedGroups] = useState<Set<string>>(
    () => new Set(results.map((result) => result.messageKey))
  );
  const knownGroupKeysRef = useRef<Set<string>>(
    new Set(results.map((result) => result.messageKey))
  );

  // 親が選択状態を持たない使い方でも開閉できるよう、表示上の選択はローカルにも持つ
  const [localSelected, setLocalSelected] = useState<number | null>(selectedIndex);
  useEffect(() => {
    setLocalSelected(selectedIndex);
  }, [selectedIndex]);

  const groups = useMemo(() => groupResults(results), [results]);

  // 外部（プレビュー）で選択された項目のグループを開く
  useEffect(() => {
    if (selectedIndex === null) return;
    const selectedResult = results[selectedIndex];
    if (!selectedResult) return;
    setClosedGroups((prev) => {
      if (!prev.has(selectedResult.messageKey)) return prev;
      const next = new Set(prev);
      next.delete(selectedResult.messageKey);
      return next;
    });
  }, [selectedIndex, results]);

  // 新しく現れたグループは閉じた状態で始め、消えたグループは忘れる
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

  const handleItemSelect = (index: number) => {
    const next = localSelected === index ? null : index;
    setLocalSelected(next);
    onSelectIndex(next);
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

    if (isOpen && localSelected !== null && group.items.some((item) => item.index === localSelected)) {
      setLocalSelected(null);
      onSelectIndex(null);
    }
  };

  if (results.length === 0) {
    if (!hasScanned) return null;
    if (totalCount > 0) {
      return (
        <div className="empty-state">
          <p>このフィルタに一致する結果はありません（全{totalCount}件）。</p>
          {onResetFilters && <PanelButton size="small" onClick={onResetFilters}>フィルタを解除</PanelButton>}
        </div>
      );
    }
    return (
      <div className="empty-state">
        <p className="empty-state__title">問題は検出されませんでした</p>
      </div>
    );
  }

  return (
    <ul className="result-groups">
      {groups.map((group) => {
        const isGroupOpen = !closedGroups.has(group.key);
        const detail = isGroupOpen ? getMessageDetail(group.key) : null;
        const canCleanup = group.items.some(({ result }) => hasAction(result, "cleanup"));

        return (
          <li key={group.key} data-testid="result-group" className="result-group">
            <button
              type="button"
              className="result-group__header"
              aria-expanded={isGroupOpen}
              onClick={() => handleGroupClick(group)}
            >
              <span className="result-group__chevron"><ChevronIcon /></span>
              <SeverityMark severity={group.severity} />
              <span className="visually-hidden">{SEVERITY_LABEL[group.severity]}</span>
              <span className="result-group__title">{group.message}</span>
              <span className="result-group__count">{group.items.length}</span>
            </button>

            {isGroupOpen && (
              <div className="result-group__body">
                {detail && (
                  <dl className="result-group__explain">
                    <div className="result-group__explain-row">
                      <dt className="result-group__tag">影響</dt>
                      <dd>{detail.impact}</dd>
                    </div>
                    <div className="result-group__explain-row">
                      <dt className="result-group__tag result-group__tag--action">対処</dt>
                      <dd>{detail.hint}</dd>
                    </div>
                  </dl>
                )}
                {canCleanup && onCleanupTargets && (
                  <div className="result-group__bulk">
                    <PanelButton
                      size="small"
                      disabled={actionsDisabled}
                      onClick={() => onCleanupTargets(group.key, group.items.map((item) => item.result))}
                    >
                      この項目をすべて削除
                    </PanelButton>
                  </div>
                )}
                <ul className="result-items" role="listbox" aria-label={group.message}>
                  {group.items.map(({ result, index }) => {
                    const isSelected = localSelected === index;
                    const variantMessage = result.message !== group.message ? result.message : "";
                    const name = result.objectName || variantMessage;
                    const showSelect = canSelectTarget(result) && onSelectTarget;
                    const showDelete = hasAction(result, "delete") && onDeleteTarget;

                    return (
                      <li
                        key={index}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={`${index + 1} ${name || result.message}`}
                        data-severity={result.severity}
                        className="result-item"
                        tabIndex={0}
                        onClick={() => handleItemSelect(index)}
                        onKeyDown={(event) => {
                          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault();
                            handleItemSelect(index);
                          }
                        }}
                      >
                        <span data-testid="result-number" className="result-item__number">{index + 1}</span>
                        <span className={name ? "result-item__name" : "result-item__name result-item__name--empty"}>
                          {result.objectName ? <span>{result.objectName}</span> : null}
                          {!result.objectName && variantMessage ? <span>{variantMessage}</span> : null}
                          {!name ? "名前なし" : null}
                          {result.layerName && <span className="result-item__layer">{result.layerName}</span>}
                          {result.objectName && variantMessage && <span className="result-item__layer">{variantMessage}</span>}
                        </span>
                        {(showSelect || showDelete) && (
                          <span className="result-item__actions">
                            {showSelect && (
                              <PanelButton
                                variant="quiet"
                                size="small"
                                aria-label="編集画面で選択"
                                title="Illustrator でこのオブジェクトを選択"
                                disabled={actionsDisabled}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onSelectTarget!(result);
                                }}
                              >
                                選択
                              </PanelButton>
                            )}
                            {showDelete && (
                              <PanelButton
                                variant="danger"
                                size="small"
                                disabled={actionsDisabled}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteTarget!(result);
                                }}
                              >
                                削除
                              </PanelButton>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

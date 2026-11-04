import React from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { getMessageDetail } from "../data/messages";

export interface MessageKeyFilterItem {
  key: string;
  count: number;
  label: string;
}

export function createMessageKeyFilterItems(results: CheckResult[]): MessageKeyFilterItem[] {
  const items: MessageKeyFilterItem[] = [];
  const itemMap = new Map<string, MessageKeyFilterItem>();
  for (const result of results) {
    let item = itemMap.get(result.messageKey);
    if (!item) {
      const detail = getMessageDetail(result.messageKey);
      item = {
        key: result.messageKey,
        count: 0,
        label: detail.problem === "問題が検出されました" ? result.messageKey : detail.problem,
      };
      itemMap.set(result.messageKey, item);
      items.push(item);
    }
    item.count += 1;
  }
  return items;
}

export interface IssueFilterPanelProps {
  items: MessageKeyFilterItem[];
  activeMessageKeys?: Set<string> | null;
  onToggleMessageKey: (messageKey: string) => void;
}

export const IssueFilterPanel: React.FC<IssueFilterPanelProps> = ({
  items,
  activeMessageKeys,
  onToggleMessageKey,
}) => (
  <div className="filter-detail">
    {items.map((item) => {
      const checked = activeMessageKeys === null || activeMessageKeys === undefined || activeMessageKeys.has(item.key);
      return (
        <label key={item.key} className="check-row" data-checked={checked ? "true" : "false"}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleMessageKey(item.key)}
          />
          <span className="check-row__label">{item.label}</span>
          <span className="check-row__count">{item.count}</span>
        </label>
      );
    })}
  </div>
);

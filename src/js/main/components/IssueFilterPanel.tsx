import React from "react";
import type { CheckResult } from "../../../jsx/hostscript/types";
import { getMessageDetail } from "../data/messages";
import { colors, spacing } from "../styles/tokens";

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
  <div
    style={{
      flexBasis: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTop: `1px solid ${colors.panelBorderSoft}`,
    }}
  >
    {items.map((item) => {
      const checked = activeMessageKeys === null || activeMessageKeys === undefined || activeMessageKeys.has(item.key);
      return (
        <label
          key={item.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            color: checked ? colors.text : "#64748b",
            fontSize: "11px",
            lineHeight: 1.35,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleMessageKey(item.key)}
            style={{ accentColor: colors.info }}
          />
          <span style={{ flex: "1 1 auto", minWidth: 0 }}>{item.label}</span>
          <span style={{ flex: "0 0 auto", color: colors.textSubtle, fontSize: "10px" }}>{item.count}</span>
        </label>
      );
    })}
  </div>
);

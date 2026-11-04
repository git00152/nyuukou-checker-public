import React from "react";
import type { ColorWorkflow } from "../settings";

export interface ProfileSelectorProps {
  value: ColorWorkflow;
  onChange: (next: ColorWorkflow) => void;
  disabled?: boolean;
}

const options: Array<{ value: ColorWorkflow; label: string; title: string }> = [
  { value: "cmyk", label: "CMYK", title: "CMYK入稿（一般的なオフセット・オンデマンド印刷）" },
  { value: "rgb", label: "RGB", title: "RGB入稿（sRGB / Adobe RGB で印刷）" },
];

/**
 * 入稿プロファイルの切替。判定基準そのものが変わるため、設定ビューに隠さずヘッダーに常に表示する。
 */
export const ProfileSelector: React.FC<ProfileSelectorProps> = ({ value, onChange, disabled = false }) => (
  <fieldset className="segmented" aria-label="入稿プロファイル">
    {options.map((option) => {
      const isSelected = option.value === value;
      return (
        <label
          key={option.value}
          className="segmented__option"
          title={option.title}
          data-checked={isSelected ? "true" : "false"}
          data-disabled={disabled ? "true" : "false"}
        >
          <input
            type="radio"
            name="color-workflow"
            value={option.value}
            checked={isSelected}
            disabled={disabled}
            aria-label={`${option.label}入稿`}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      );
    })}
  </fieldset>
);

import React, { useState } from "react";
import type { AppSettings } from "../settings";
import { colors, radii, spacing } from "../styles/tokens";
import { PanelButton } from "./PanelButton";

export interface SettingsPanelProps {
  settings: AppSettings;
  onChangeSettings: (next: AppSettings) => void;
  disabled?: boolean;
  onOpenAcrobatTacCheck: () => void;
  onCleanupAcrobatPdf: () => void;
}

type SettingKey = keyof AppSettings;

const settingRows: Array<{ key: SettingKey; label: string; section: "check" | "display" }> = [
  { key: "largePrintMode", label: "大判印刷モード", section: "check" },
  { key: "detectOpenPaths", label: "オープンパスを検出する", section: "check" },
  { key: "detectFilledOpenPaths", label: "オープンパスの塗り設定を検出する", section: "check" },
  { key: "includeGuides", label: "ガイドを検出対象に含める", section: "check" },
  { key: "includeTrimMarkLayers", label: "トンボレイヤーを検出対象に含める", section: "check" },
  { key: "autoPanToSelection", label: "検出結果選択時にプレビューを自動移動", section: "display" },
  { key: "confirmBeforeDelete", label: "削除前に確認ダイアログを表示", section: "display" },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChangeSettings,
  disabled = false,
  onOpenAcrobatTacCheck,
  onCleanupAcrobatPdf,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const setValue = (key: SettingKey, checked: boolean) => {
    onChangeSettings({ ...settings, [key]: checked });
  };

  const renderRows = (section: "check" | "display") => (
    <div style={{ display: "grid", gap: spacing.sm }}>
      {settingRows.filter((row) => row.section === section).map((row) => (
        <label
          key={row.key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "12px",
            color: disabled ? colors.textSubtle : colors.textMuted,
            lineHeight: 1.4,
          }}
        >
          <input
            type="checkbox"
            checked={settings[row.key]}
            disabled={disabled}
            onChange={(event) => setValue(row.key, event.target.checked)}
            style={{ cursor: disabled ? "not-allowed" : "pointer", accentColor: colors.primary }}
          />
          <span>{row.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <PanelButton
        type="button"
        variant="secondary"
        fullWidth
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        設定
      </PanelButton>

      {isOpen && (
        <div
          style={{
            display: "grid",
            gap: spacing.lg,
            padding: "10px",
            border: `1px solid ${colors.panelBorder}`,
            borderRadius: radii.md,
            background: colors.panelBgRaised,
          }}
        >
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: colors.textMuted, fontSize: "11px", fontWeight: 700 }}>チェック設定</div>
            {renderRows("check")}
          </div>

          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: colors.textMuted, fontSize: "11px", fontWeight: 700 }}>表示・操作設定</div>
            {renderRows("display")}
          </div>

          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: colors.textMuted, fontSize: "11px", fontWeight: 700 }}>補助操作</div>
            <PanelButton
              onClick={onOpenAcrobatTacCheck}
              disabled={disabled}
              variant="secondary"
              fullWidth
            >
              AcrobatでTAC確認
            </PanelButton>
            <PanelButton
              onClick={onCleanupAcrobatPdf}
              disabled={disabled}
              variant="utility"
              fullWidth
            >
              一時PDFを削除
            </PanelButton>
          </div>
        </div>
      )}
    </div>
  );
};

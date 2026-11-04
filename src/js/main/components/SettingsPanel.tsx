import React from "react";
import type { AppSettings, BooleanSettingKey } from "../settings";
import { PanelButton } from "./PanelButton";

export interface SettingsPanelProps {
  settings: AppSettings;
  onChangeSettings: (next: AppSettings) => void;
  disabled?: boolean;
  onOpenAcrobatTacCheck: () => void;
  onCleanupAcrobatPdf: () => void;
}

type SectionId = "criteria" | "targets" | "behavior";

const settingRows: Array<{ key: BooleanSettingKey; label: string; section: SectionId; help?: string }> = [
  {
    key: "largePrintMode",
    label: "大判印刷モード",
    section: "criteria",
    help: "画像は200dpi以上を許容し、塗り足しの既定値による判定は参考扱いにします。",
  },
  { key: "detectOpenPaths", label: "オープンパス", section: "targets" },
  { key: "detectFilledOpenPaths", label: "塗りのあるオープンパス", section: "targets" },
  { key: "includeTrimMarkLayers", label: "トンボのレイヤー", section: "targets" },
  { key: "autoPanToSelection", label: "選択した結果へプレビューを移動", section: "behavior" },
  { key: "confirmBeforeDelete", label: "削除前に確認する", section: "behavior" },
];

const sections: Array<{ id: SectionId; title: string; affectsResults: boolean }> = [
  { id: "criteria", title: "入稿条件", affectsResults: true },
  { id: "targets", title: "検出対象", affectsResults: true },
  { id: "behavior", title: "操作", affectsResults: false },
];

/**
 * 設定ビュー。結果リストの位置に入れ替わって表示する。
 * 判定に効く設定（入稿条件・検出対象）には「次のチェックから反映」と明記する。
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onChangeSettings,
  disabled = false,
  onOpenAcrobatTacCheck,
  onCleanupAcrobatPdf,
}) => {
  const setValue = (key: BooleanSettingKey, checked: boolean) => {
    onChangeSettings({ ...settings, [key]: checked });
  };

  return (
    <section className="settings" aria-label="設定">
      {sections.map((section) => {
        const headingId = `settings-${section.id}`;
        return (
          <div key={section.id} className="settings__section" role="group" aria-labelledby={headingId}>
            <h2 id={headingId} className="settings__heading">
              <span>{section.title}</span>
              {section.affectsResults && <span className="settings__note">次のチェックから反映</span>}
            </h2>
            <div className="settings__rows">
              {settingRows.filter((row) => row.section === section.id).map((row) => (
                <div key={row.key}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings[row.key]}
                      disabled={disabled}
                      onChange={(event) => setValue(row.key, event.target.checked)}
                    />
                    <span className="check-row__label">{row.label}</span>
                  </label>
                  {row.help && <p className="settings__help">{row.help}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {settings.colorWorkflow === "cmyk" && (
        <div className="settings__section" role="group" aria-labelledby="settings-tools">
          <h2 id="settings-tools" className="settings__heading"><span>インク総量の確認</span></h2>
          <div className="settings__actions">
            <PanelButton size="small" onClick={onOpenAcrobatTacCheck} disabled={disabled}>
              AcrobatでTAC確認
            </PanelButton>
            <PanelButton size="small" variant="quiet" onClick={onCleanupAcrobatPdf} disabled={disabled}>
              一時PDFを削除
            </PanelButton>
          </div>
          <p className="settings__help">確認用PDFを書き出し、Acrobat の出力プレビューで開きます。</p>
        </div>
      )}
    </section>
  );
};

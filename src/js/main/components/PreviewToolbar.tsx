import React from "react";
import { PanelButton } from "./PanelButton";
import { colors, spacing } from "../styles/tokens";

export interface PreviewToolbarProps {
  zoomPercent: number;
  hasSelection: boolean;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
  onFitToView: () => void;
  onScrollToSelected: () => void;
}

export const PreviewToolbar: React.FC<PreviewToolbarProps> = ({
  zoomPercent,
  hasSelection,
  onZoomOut,
  onResetZoom,
  onZoomIn,
  onFitToView,
  onScrollToSelected,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderBottom: `1px solid ${colors.previewBorder}`,
      background: colors.previewToolbarBg,
      flexShrink: 0,
      overflowX: "auto",
    }}
  >
    <PanelButton type="button" variant="toolbar" aria-label="縮小" onClick={onZoomOut}>-</PanelButton>
    <PanelButton type="button" variant="toolbar" aria-label="100%に戻す" onClick={onResetZoom}>
      {zoomPercent}%
    </PanelButton>
    <PanelButton type="button" variant="toolbar" aria-label="拡大" onClick={onZoomIn}>+</PanelButton>
    <PanelButton type="button" variant="toolbar" aria-label="全体表示" onClick={onFitToView}>全体</PanelButton>
    <PanelButton
      type="button"
      variant="toolbar"
      aria-label="選択項目へ移動"
      onClick={onScrollToSelected}
      disabled={!hasSelection}
    >
      選択へ
    </PanelButton>
  </div>
);

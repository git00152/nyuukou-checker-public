import React from "react";
import { PanelButton } from "./PanelButton";
import { FitIcon, TargetIcon, ZoomInIcon, ZoomOutIcon } from "./icons";

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
  <div className="preview-toolbar" role="toolbar" aria-label="プレビュー表示">
    <PanelButton variant="quiet" icon aria-label="縮小" title="縮小（-）" onClick={onZoomOut}><ZoomOutIcon /></PanelButton>
    <PanelButton variant="quiet" size="small" className="preview-toolbar__zoom" aria-label="100%に戻す" title="100%に戻す（0）" onClick={onResetZoom}>
      {zoomPercent}%
    </PanelButton>
    <PanelButton variant="quiet" icon aria-label="拡大" title="拡大（+）" onClick={onZoomIn}><ZoomInIcon /></PanelButton>
    <span className="preview-toolbar__sep" aria-hidden="true" />
    <PanelButton variant="quiet" icon aria-label="全体表示" title="全体表示" onClick={onFitToView}><FitIcon /></PanelButton>
    <PanelButton
      variant="quiet"
      icon
      aria-label="選択項目へ移動"
      title="選択項目へ移動"
      onClick={onScrollToSelected}
      disabled={!hasSelection}
    >
      <TargetIcon />
    </PanelButton>
  </div>
);

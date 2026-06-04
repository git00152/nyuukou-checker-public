import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckResult, ScopeInfo } from "../../../jsx/hostscript/types";
import { ilBoundsToSvgRect } from "../utils/svgCoordinates";
import { colors, shadows, spacing } from "../styles/tokens";
import { PreviewToolbar } from "./PreviewToolbar";
import { SVGPreview } from "./SVGPreview";

type CheckStatus = "idle" | "checking" | "done" | "error" | "no-document";

export interface PreviewViewportProps {
  scopeInfo: ScopeInfo | null;
  results: CheckResult[];
  selectedIndex: number | null;
  onSelectIndex: (i: number | null) => void;
  status: CheckStatus;
  previewDataUrl?: string | null;
  previewArtboardBounds?: [number, number, number, number] | null;
  autoPanToSelection?: boolean;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.25;
const PAN_STEP = 48;
const DEFAULT_BASE_WIDTH = 640;
const DEFAULT_BASE_HEIGHT = 480;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

function getBoundsSize(scopeInfo: ScopeInfo | null): { width: number; height: number } {
  if (!scopeInfo) {
    return { width: DEFAULT_BASE_WIDTH, height: DEFAULT_BASE_HEIGHT };
  }
  const width = Math.abs(scopeInfo.bounds[2] - scopeInfo.bounds[0]);
  const height = Math.abs(scopeInfo.bounds[1] - scopeInfo.bounds[3]);
  if (width <= 0 || height <= 0) {
    return { width: DEFAULT_BASE_WIDTH, height: DEFAULT_BASE_HEIGHT };
  }
  return { width, height };
}

function getBaseSize(container: HTMLDivElement | null, scopeInfo: ScopeInfo | null): { width: number; height: number } {
  const boundsSize = getBoundsSize(scopeInfo);
  const containerWidth = container?.clientWidth || DEFAULT_BASE_WIDTH;
  const containerHeight = container?.clientHeight || DEFAULT_BASE_HEIGHT;
  const scale = Math.min(containerWidth / boundsSize.width, containerHeight / boundsSize.height);
  if (!Number.isFinite(scale) || scale <= 0) {
    return { width: DEFAULT_BASE_WIDTH, height: DEFAULT_BASE_HEIGHT };
  }
  return {
    width: Math.max(1, boundsSize.width * scale),
    height: Math.max(1, boundsSize.height * scale),
  };
}

export const PreviewViewport: React.FC<PreviewViewportProps> = ({
  scopeInfo,
  results,
  selectedIndex,
  onSelectIndex,
  status,
  previewDataUrl,
  previewArtboardBounds,
  autoPanToSelection = true,
}) => {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const boundsSize = useMemo(() => getBoundsSize(scopeInfo), [scopeInfo]);
  const baseSize = getBaseSize(scrollRef.current, scopeInfo);
  const surfaceWidth = baseSize.width * zoom;
  const surfaceHeight = baseSize.height * zoom;

  const changeZoom = useCallback((delta: number) => {
    setZoom((prev) => clampZoom(prev + delta));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const fitToView = useCallback(() => {
    setZoom(1);
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }, []);

  const scrollToSelected = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !scopeInfo || selectedIndex === null) return;
    const selectedResult = results[selectedIndex];
    const svgRect = ilBoundsToSvgRect(selectedResult?.bounds, scopeInfo.bounds);
    if (!svgRect) return;

    const scaleX = surfaceWidth / boundsSize.width;
    const scaleY = surfaceHeight / boundsSize.height;
    const centerX = (svgRect.x - scopeInfo.bounds[0] + (svgRect.width / 2)) * scaleX;
    const centerY = (svgRect.y - scopeInfo.bounds[3] + (svgRect.height / 2)) * scaleY;
    const visibleWidth = el.clientWidth || DEFAULT_BASE_WIDTH;
    const visibleHeight = el.clientHeight || DEFAULT_BASE_HEIGHT;
    el.scrollLeft = Math.max(0, centerX - visibleWidth / 2);
    el.scrollTop = Math.max(0, centerY - visibleHeight / 2);
  }, [boundsSize.height, boundsSize.width, results, scopeInfo, selectedIndex, surfaceHeight, surfaceWidth]);

  useEffect(() => {
    if (!autoPanToSelection) return;
    scrollToSelected();
  }, [autoPanToSelection, scrollToSelected]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(ZOOM_STEP);
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      changeZoom(-ZOOM_STEP);
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      resetZoom();
      return;
    }
    if (!el) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      el.scrollLeft = Math.max(0, el.scrollLeft - PAN_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      el.scrollLeft += PAN_STEP;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      el.scrollTop = Math.max(0, el.scrollTop - PAN_STEP);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      el.scrollTop += PAN_STEP;
    }
  }, [changeZoom, resetZoom]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        background: colors.previewBg,
      }}
    >
      <PreviewToolbar
        zoomPercent={Math.round(zoom * 100)}
        hasSelection={selectedIndex !== null}
        onZoomOut={() => changeZoom(-ZOOM_STEP)}
        onResetZoom={resetZoom}
        onZoomIn={() => changeZoom(ZOOM_STEP)}
        onFitToView={fitToView}
        onScrollToSelected={scrollToSelected}
      />
      <div
        ref={scrollRef}
        data-testid="preview-scroll-area"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          overflow: "auto",
          padding: spacing.xxl,
          outline: "none",
        }}
      >
        <div
          data-testid="preview-zoom-surface"
          style={{
            width: `${surfaceWidth}px`,
            height: `${surfaceHeight}px`,
            aspectRatio: `${boundsSize.width} / ${boundsSize.height}`,
            margin: "0 auto",
            boxShadow: shadows.artboard,
            background: colors.artboardBg,
          }}
        >
          <SVGPreview
            scopeInfo={scopeInfo}
            results={results}
            selectedIndex={selectedIndex}
            onSelectIndex={onSelectIndex}
            status={status}
            previewDataUrl={previewDataUrl}
            previewArtboardBounds={previewArtboardBounds}
          />
        </div>
      </div>
    </div>
  );
};

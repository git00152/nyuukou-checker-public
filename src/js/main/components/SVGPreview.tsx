import React from "react";
import type { CheckResult, ScopeInfo } from "../../../jsx/hostscript/types";
import {
  scopeToViewBox,
  ilBoundsToSvgRect,
} from "../utils/svgCoordinates";
import { colors, svgSeverityColors } from "../styles/tokens";

// severity カラーマップ
const SEVERITY_COLOR = svgSeverityColors;

export interface SVGPreviewProps {
  scopeInfo: ScopeInfo | null;
  results: CheckResult[];         // フィルタ済み results（App から渡される）
  selectedIndex: number | null;   // filteredResults 内のインデックス
  onSelectIndex: (i: number | null) => void;
  status: "idle" | "checking" | "done" | "error" | "no-document";
  previewDataUrl?: string | null;
  previewArtboardBounds?: [number, number, number, number] | null;
}

// -------------------------------------------------------------------
// OverlayRect: bounds を持つ CheckResult を SVG <rect> としてオーバーレイ描画する
// 内部ヘルパーコンポーネント（SVGPreview ファイル内に定義）
// -------------------------------------------------------------------
interface OverlayRectProps {
  result: CheckResult;
  index: number;
  scope: [number, number, number, number];
  isSelected: boolean;
  hasSelection: boolean;
  onSelectIndex: (i: number | null) => void;
  selectedIndex: number | null;
}

const OverlayRect: React.FC<OverlayRectProps> = ({
  result,
  index,
  scope,
  isSelected,
  hasSelection,
  onSelectIndex,
  selectedIndex,
}) => {
  const svgRect = ilBoundsToSvgRect(result.bounds, scope);
  if (!svgRect) return null;

  const color = SEVERITY_COLOR[result.severity];
  const label = String(index + 1);
  const strokeWidth = isSelected ? 4 : 1.5;
  const fillOpacity = isSelected ? 0.2 : 0.08;
  const labelBackgroundOpacity = isSelected ? 0.95 : 0.75;
  const opacity = hasSelection && !isSelected ? 0.3 : 1;
  const labelWidth = Math.max(14, label.length * 6 + 8);
  const labelHeight = 14;
  const labelX = svgRect.x + 3;
  const labelY = svgRect.y + 3;

  const handleClick = () => {
    onSelectIndex(selectedIndex === index ? null : index);
  };

  return (
    <g
      data-testid="overlay-group"
      style={{ cursor: "pointer" }}
      onClick={handleClick}
    >
      <rect
        data-testid="overlay-rect"
        data-selected={isSelected ? "true" : "false"}
        x={svgRect.x}
        y={svgRect.y}
        width={svgRect.width}
        height={svgRect.height}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity}
        rx="2"
        ry="2"
      />
      <rect
        data-testid="overlay-label-background"
        x={labelX}
        y={labelY}
        width={labelWidth}
        height={labelHeight}
        rx="3"
        ry="3"
        fill={color}
        fillOpacity={labelBackgroundOpacity}
        opacity={opacity}
        style={{ pointerEvents: "none" }}
      />
      <text
        data-testid="overlay-label"
        x={labelX + labelWidth / 2}
        y={labelY + 10}
        fontSize="10"
        fontWeight="bold"
        fill="#ffffff"
        opacity={opacity}
        textAnchor="middle"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
};

// -------------------------------------------------------------------
// SVGPreview: メインコンポーネント
// -------------------------------------------------------------------
export const SVGPreview: React.FC<SVGPreviewProps> = ({
  scopeInfo,
  results,
  selectedIndex,
  onSelectIndex,
  status,
  previewDataUrl,
  previewArtboardBounds,
}) => {
  // チェック中: スピナー表示
  if (status === "checking") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          minHeight: "120px",
          background: colors.artboardBg,
        }}
      >
        <div
          data-testid="spinner"
          style={{
            width: "32px",
            height: "32px",
            border: `3px solid ${colors.text}`,
            borderTop: `3px solid ${colors.infoStrong}`,
            borderRadius: "50%",
            animation: "svgpreview-spin 0.8s linear infinite",
          }}
        />
        <style>{`
          @keyframes svgpreview-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // scopeInfo が null: プレースホルダー表示
  if (!scopeInfo) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          minHeight: "80px",
          color: "#a0aec0",
          fontSize: "12px",
          background: "#f7fafc",
          borderRadius: "4px",
        }}
      >
        アートボード情報なし
      </div>
    );
  }

  // bounds が [0,0,0,0] の場合は有効なスコープがないことを示す
  const boundsW = Math.abs(scopeInfo.bounds[2] - scopeInfo.bounds[0]);
  const boundsH = Math.abs(scopeInfo.bounds[1] - scopeInfo.bounds[3]);
  if (boundsW === 0 || boundsH === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          minHeight: "80px",
          color: colors.errorStrong,
          fontSize: "12px",
          background: "#fff5f5",
          borderRadius: "4px",
          padding: "8px",
          boxSizing: "border-box",
          wordBreak: "break-all",
        }}
      >
        アートボードのサイズが不正です
      </div>
    );
  }

  const viewBox = scopeToViewBox(scopeInfo.bounds);
  const hasSelection = selectedIndex !== null;

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: colors.artboardBg,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* アートボード背景矩形 */}
      <rect
        x={scopeInfo.bounds[0]}
        y={scopeInfo.bounds[3]}
        width={scopeInfo.bounds[2] - scopeInfo.bounds[0]}
        height={scopeInfo.bounds[1] - scopeInfo.bounds[3]}
        fill={colors.artboardBg}
        stroke="#cbd5e0"
        strokeWidth="1"
      />

      {/* デザイン画像背景 */}
      {/* previewArtboardBounds: artBoardClipping で書き出した PNG のアートボード矩形（Illustrator 座標系）*/}
      {/* ilBoundsToSvgRect で SVG 座標に変換して配置することで、オーバーレイと正確に重なる */}
      {previewDataUrl && (() => {
        const imgBounds = previewArtboardBounds ?? scopeInfo.bounds;
        const imgRect = ilBoundsToSvgRect(imgBounds, scopeInfo.bounds);
        if (!imgRect) return null;
        return (
          <image
            data-testid="preview-image"
            href={previewDataUrl}
            x={imgRect.x}
            y={imgRect.y}
            width={imgRect.width}
            height={imgRect.height}
            preserveAspectRatio="none"
          />
        );
      })()}

      {/* チェック結果オーバーレイ */}
      {results.map((result, i) => (
        <OverlayRect
          key={i}
          result={result}
          index={i}
          scope={scopeInfo.bounds}
          isSelected={selectedIndex === i}
          hasSelection={hasSelection}
          onSelectIndex={onSelectIndex}
          selectedIndex={selectedIndex}
        />
      ))}
    </svg>
  );
};

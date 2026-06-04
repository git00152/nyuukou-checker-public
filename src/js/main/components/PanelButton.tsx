import React from "react";
import { colors, radii, shadows } from "../styles/tokens";

type PanelButtonVariant = "primary" | "secondary" | "utility" | "toolbar";

export interface PanelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PanelButtonVariant;
  fullWidth?: boolean;
  pressed?: boolean;
}

const variantStyle: Record<PanelButtonVariant, React.CSSProperties> = {
  primary: {
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryStrong})`,
    color: "#fff",
    border: "none",
    boxShadow: shadows.primary,
    fontSize: "13px",
  },
  secondary: {
    background: "rgba(255,255,255,0.08)",
    color: "#dbeafe",
    border: `1px solid rgba(147, 197, 253, 0.35)`,
    fontSize: "12px",
  },
  utility: {
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    border: "1px solid rgba(203, 213, 225, 0.22)",
    fontSize: "12px",
  },
  toolbar: {
    background: "#fff",
    color: "#1f2937",
    border: `1px solid ${colors.previewBorder}`,
    fontSize: "12px",
  },
};

export const PanelButton: React.FC<PanelButtonProps> = ({
  variant = "secondary",
  fullWidth = false,
  pressed = false,
  disabled,
  style,
  children,
  ...buttonProps
}) => {
  const base = variantStyle[variant];
  return (
    <button
      {...buttonProps}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        width: fullWidth ? "100%" : undefined,
        minHeight: variant === "toolbar" ? "28px" : undefined,
        padding: variant === "toolbar" ? "4px 9px" : "8px 10px",
        borderRadius: radii.sm,
        cursor: disabled ? "default" : "pointer",
        fontWeight: 600,
        letterSpacing: 0,
        opacity: disabled ? 0.64 : 1,
        outlineColor: colors.focus,
        ...base,
        ...(pressed ? { background: colors.primary, color: "#fff", borderColor: colors.primary } : null),
        ...(disabled && variant === "primary" ? { background: "#2d3748", boxShadow: "none" } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
};

import React from "react";

type PanelButtonVariant = "primary" | "default" | "quiet" | "danger";

export interface PanelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PanelButtonVariant;
  size?: "regular" | "small";
  /** アイコンだけのボタン。aria-label を必ず渡す。 */
  icon?: boolean;
  pressed?: boolean;
}

/** パネル共通のボタン。見た目は panel.css の .btn 系クラスで決める。 */
export const PanelButton: React.FC<PanelButtonProps> = ({
  variant = "default",
  size = "regular",
  icon = false,
  pressed,
  className,
  type = "button",
  children,
  ...buttonProps
}) => {
  const classes = ["btn"];
  if (variant === "primary") classes.push("btn--primary");
  if (variant === "quiet") classes.push("btn--quiet");
  if (variant === "danger") classes.push("btn--quiet", "btn--danger");
  if (size === "small") classes.push("btn--small");
  if (icon) classes.push("btn--icon");
  if (className) classes.push(className);
  return (
    <button
      {...buttonProps}
      type={type}
      aria-pressed={pressed === undefined ? buttonProps["aria-pressed"] : pressed}
      className={classes.join(" ")}
    >
      {children}
    </button>
  );
};

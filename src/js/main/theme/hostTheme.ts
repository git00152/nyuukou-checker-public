/**
 * Illustrator の UI の明るさ（環境設定 > ユーザーインターフェイス）にパネルの配色を合わせる。
 * 色そのものは panel.css の [data-theme] ごとの CSS 変数で定義し、ここでは判定と適用だけを行う。
 */

export type HostThemeName = "darkest" | "dark" | "light" | "lightest";

export interface HostTheme {
  name: HostThemeName;
  /** ホストのパネル背景色。標準パネルと完全に同じ色にするため CSS 変数 --host-bg に入れる。 */
  background: string;
  /** ホストが報告する UI フォント名。日本語の字形がない場合は panel.css の後続フォントで補う。 */
  fontFamily?: string;
}

export const THEME_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";
export const DEFAULT_THEME_NAME: HostThemeName = "darkest";

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

interface CepBridge {
  getHostEnvironment?: () => string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/** Illustrator の 4 段階（概ね 50 / 83 / 184 / 240）の中間で区切る。 */
export function themeFromColor(color: RgbColor): HostThemeName {
  const luminance = 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue;
  if (luminance < 66) return "darkest";
  if (luminance < 128) return "dark";
  if (luminance < 212) return "light";
  return "lightest";
}

function getBridge(): CepBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { __adobe_cep__?: CepBridge }).__adobe_cep__;
  return bridge && typeof bridge.getHostEnvironment === "function" ? bridge : null;
}

export function readHostTheme(): HostTheme | null {
  const bridge = getBridge();
  if (!bridge || !bridge.getHostEnvironment) return null;
  try {
    const env = JSON.parse(bridge.getHostEnvironment());
    const color = env?.appSkinInfo?.panelBackgroundColor?.color as RgbColor | undefined;
    if (!color || typeof color.red !== "number") return null;
    const red = Math.round(color.red);
    const green = Math.round(color.green);
    const blue = Math.round(color.blue);
    const theme: HostTheme = {
      name: themeFromColor({ red, green, blue }),
      background: `rgb(${red}, ${green}, ${blue})`,
    };
    const fontFamily = env?.appSkinInfo?.baseFontFamily;
    if (typeof fontFamily === "string" && fontFamily.trim()) theme.fontFamily = fontFamily.trim();
    return theme;
  } catch {
    return null;
  }
}

export function applyHostTheme(root: HTMLElement, theme: HostTheme | null): void {
  root.dataset.theme = theme ? theme.name : DEFAULT_THEME_NAME;
  if (theme) {
    root.style.setProperty("--host-bg", theme.background);
  } else {
    root.style.removeProperty("--host-bg");
  }
  if (theme && theme.fontFamily) {
    root.style.setProperty("--host-font", `"${theme.fontFamily.replace(/["\\]/g, "")}"`);
  } else {
    root.style.removeProperty("--host-font");
  }
}

export function subscribeHostTheme(onChange: (theme: HostTheme | null) => void): () => void {
  const bridge = getBridge();
  if (!bridge || !bridge.addEventListener) return () => {};
  const listener = () => onChange(readHostTheme());
  bridge.addEventListener(THEME_CHANGED_EVENT, listener);
  return () => {
    if (bridge.removeEventListener) bridge.removeEventListener(THEME_CHANGED_EVENT, listener);
  };
}

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  THEME_CHANGED_EVENT,
  applyHostTheme,
  readHostTheme,
  subscribeHostTheme,
  themeFromColor,
} from "../../src/js/main/theme/hostTheme";

const skin = (red: number, green: number, blue: number) => JSON.stringify({
  appSkinInfo: { panelBackgroundColor: { color: { red, green, blue, alpha: 255 } } },
});

describe("themeFromColor", () => {
  it("Illustrator の UI 明るさ 4 段階をそれぞれ判定する", () => {
    expect(themeFromColor({ red: 50, green: 50, blue: 50 })).toBe("darkest");
    expect(themeFromColor({ red: 83, green: 83, blue: 83 })).toBe("dark");
    expect(themeFromColor({ red: 184, green: 184, blue: 184 })).toBe("light");
    expect(themeFromColor({ red: 240, green: 240, blue: 240 })).toBe("lightest");
  });
});

describe("readHostTheme", () => {
  afterEach(() => {
    delete (window as any).__adobe_cep__;
  });

  it("CEP がない環境では null を返す", () => {
    expect(readHostTheme()).toBeNull();
  });

  it("ホストのパネル背景色から名前と CSS 色を返す", () => {
    (window as any).__adobe_cep__ = { getHostEnvironment: () => skin(83, 83, 83) };
    expect(readHostTheme()).toEqual({ name: "dark", background: "rgb(83, 83, 83)" });
  });

  it("ホストの UI フォント名を返す", () => {
    (window as any).__adobe_cep__ = {
      getHostEnvironment: () => JSON.stringify({
        appSkinInfo: { baseFontFamily: "Adobe Clean", panelBackgroundColor: { color: { red: 50, green: 50, blue: 50 } } },
      }),
    };
    expect(readHostTheme()).toEqual({ name: "darkest", background: "rgb(50, 50, 50)", fontFamily: "Adobe Clean" });
  });

  it("ホスト情報が壊れていても例外にしない", () => {
    (window as any).__adobe_cep__ = { getHostEnvironment: () => "{not json" };
    expect(readHostTheme()).toBeNull();
  });
});

describe("applyHostTheme", () => {
  it("data-theme とホスト背景色の CSS 変数を設定する", () => {
    const root = document.createElement("div");
    applyHostTheme(root, { name: "light", background: "rgb(184, 184, 184)" });
    expect(root.dataset.theme).toBe("light");
    expect(root.style.getPropertyValue("--host-bg")).toBe("rgb(184, 184, 184)");
  });

  it("ホストの UI フォントを先頭にしたフォント指定を CSS 変数に入れる", () => {
    const root = document.createElement("div");
    applyHostTheme(root, { name: "dark", background: "rgb(83, 83, 83)", fontFamily: "Adobe Clean" });
    expect(root.style.getPropertyValue("--host-font")).toBe('"Adobe Clean"');
    applyHostTheme(root, { name: "dark", background: "rgb(83, 83, 83)" });
    expect(root.style.getPropertyValue("--host-font")).toBe("");
  });

  it("null の場合は既定の darkest を使う", () => {
    const root = document.createElement("div");
    applyHostTheme(root, null);
    expect(root.dataset.theme).toBe("darkest");
    expect(root.style.getPropertyValue("--host-bg")).toBe("");
  });
});

describe("subscribeHostTheme", () => {
  afterEach(() => {
    delete (window as any).__adobe_cep__;
  });

  it("Illustrator 側で UI の明るさが変わると新しいテーマを通知し、解除できる", () => {
    let current = skin(50, 50, 50);
    const listeners: Record<string, Function> = {};
    const removeEventListener = vi.fn();
    (window as any).__adobe_cep__ = {
      getHostEnvironment: () => current,
      addEventListener: (type: string, fn: Function) => { listeners[type] = fn; },
      removeEventListener,
    };
    const onChange = vi.fn();
    const unsubscribe = subscribeHostTheme(onChange);

    current = skin(240, 240, 240);
    listeners[THEME_CHANGED_EVENT]();
    expect(onChange).toHaveBeenCalledWith({ name: "lightest", background: "rgb(240, 240, 240)" });

    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith(THEME_CHANGED_EVENT, listeners[THEME_CHANGED_EVENT]);
  });

  it("CEP がない環境では何もしない解除関数を返す", () => {
    const unsubscribe = subscribeHostTheme(vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});

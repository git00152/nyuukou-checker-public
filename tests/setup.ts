import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Node.js 25 以降は実験的な global localStorage を持ち、--localstorage-file なしでは
// setItem などが使えない。これが jsdom の localStorage を覆い隠すため、
// 使えない場合だけメモリ上の Storage に差し替える。
function installMemoryStorageIfBroken() {
  // node 環境で実行するテストファイルには window がない
  if (typeof window === "undefined") return;
  let usable = false;
  try {
    usable = typeof window.localStorage?.setItem === "function";
  } catch {
    usable = false;
  }
  if (usable) return;
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key); },
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}
installMemoryStorageIfBroken();

// 設定は localStorage に保存されるため、テスト間で状態を持ち越さない
afterEach(() => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.clear();
  } catch {
    // localStorage が使えない環境では何もしない
  }
});

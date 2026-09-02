import "@testing-library/jest-dom/vitest";

/* ==================== localStorage polyfill ====================
 * Node 22 内置了全局 localStorage（undici 实现），但其实现可能与 jsdom
 * 冲突或缺少 clear 等方法。这里在测试启动早期提供一个完整可靠的 polyfill
 * 作为兜底，确保 store.ts 的 load()/save() 行为可预测。
 * ================================================================ */
function ensureLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
  } as Storage;
}

// 仅当 localStorage 缺失或 clear 不是函数时替换为 polyfill
const needsPolyfill =
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage.clear !== "function";
if (needsPolyfill) {
  Object.defineProperty(globalThis, "localStorage", {
    value: ensureLocalStorage(),
    configurable: true,
    writable: true,
  });
}

/* ==================== jsdom API 补丁 ==================== */
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error: 测试 stub 注入，类型上忽略
  window.ResizeObserver = ResizeObserverStub;
  // @ts-expect-error: 同上
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  };

  if (!window.alert) {
    // @ts-expect-error: 测试 stub
    window.alert = () => {};
    // @ts-expect-error: 测试 stub
    window.confirm = () => true;
  }
}

if (typeof URL !== "undefined" && !URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock";
  // @ts-expect-error: 测试 stub
  URL.revokeObjectURL = () => {};
}

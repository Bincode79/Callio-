import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const APP_PREFIX = "/app";

interface RouterValue {
  path: string;
  base: string;
  param?: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function readHash(): string {
  return window.location.hash.replace(/^#/, "");
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(readHash);

  useEffect(() => {
    const onHashChange = () => setPath(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: string) => {
    const target = next.startsWith(APP_PREFIX) ? next : `${APP_PREFIX}${next}`;
    window.location.hash = target;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const value = useMemo<RouterValue>(() => {
    const inApp = path === APP_PREFIX || path.startsWith(`${APP_PREFIX}/`);
    const segments = (inApp ? path.slice(APP_PREFIX.length) : path).split("/").filter(Boolean);
    return { path, base: segments[0] ?? "tong-quan", param: segments[1], navigate };
  }, [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}

export interface RouteInfo {
  /** True khi hash hiện tại trỏ tới ứng dụng sản phẩm thay vì trang giới thiệu. */
  inApp: boolean;
  segments: string[];
  base: string;
  param?: string;
}

export function useRoute(): RouteInfo {
  const { path } = useRouter();
  const inApp = path === APP_PREFIX || path.startsWith(`${APP_PREFIX}/`);
  const segments = (inApp ? path.slice(APP_PREFIX.length) : path).split("/").filter(Boolean);
  return { inApp, segments, base: segments[0] ?? "tong-quan", param: segments[1] };
}

export function appHref(path: string): string {
  return `#${APP_PREFIX}${path}`;
}

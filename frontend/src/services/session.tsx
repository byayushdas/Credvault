/* eslint-disable react/only-export-components -- The provider and its typed hooks share one small authentication boundary. */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { api, setCsrf, ApiError } from "./api";
import type { User } from "./api";

interface State {
  user: User | null;
  loading: boolean;
  error: string;
  revision: number;
  live: boolean;
  refresh: () => void;
  restore: () => Promise<User | null>;
  logout: () => Promise<void>;
}
const Context = createContext<State>(null!);
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("credvault-session");
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [live, setLive] = useState(false);
  const liveConnected = useRef(false);
  const restore = useCallback(async () => {
    try {
      const u = await api<User>("/auth/me");
      setUser(u);
      setCsrf(u.csrf);
      setError("");
      return u;
    } catch (e) {
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        setUser(null);
        setCsrf("");
      }
      if (e instanceof Error && !e.message.includes("session has expired"))
        setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Restore an external server session on mount.
    void restore();
    const expire = () => {
      setUser(null);
      setCsrf("");
    };
    const sync = () => {
      void restore();
      refresh();
    };
    window.addEventListener("focus", sync);
    window.addEventListener("session-expired", expire);
    channel?.addEventListener("message", sync);
    const timer = window.setInterval(() => {
      if (!liveConnected.current && document.visibilityState === "visible")
        sync();
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("session-expired", expire);
      channel?.removeEventListener("message", sync);
    };
  }, [restore, refresh]);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const stream = new EventSource("/api/v1/events");
    stream.onopen = () => {
      liveConnected.current = true;
      setLive(true);
    };
    stream.addEventListener("change", () => {
      refresh();
      void restore();
    });
    stream.onerror = () => {
      liveConnected.current = false;
      setLive(false);
    };
    stream.addEventListener("session-expired", () => {
      stream.close();
      window.dispatchEvent(new Event("session-expired"));
    });
    return () => {
      stream.close();
      liveConnected.current = false;
    };
  }, [userId, refresh, restore]);
  const logout = async () => {
    await api("/auth/logout", "POST");
    setUser(null);
    setCsrf("");
    refresh();
    channel?.postMessage("logout");
  };
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        revision,
        live: !!user && live,
        refresh,
        restore,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  return useContext(Context);
}
export function useResource<T>(path: string | null) {
  const { revision } = useSession();
  const [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [loadedPath, setLoadedPath] = useState<string | null>(null),
    [loadedRevision, setLoadedRevision] = useState(-1),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) return;
    api<T>(path)
      .then((v) => {
        if (active) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setData(undefined);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoadedPath(path);
          setLoadedRevision(revision);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [path, revision, retry]);
  return {
    data: loadedPath === path ? data : undefined,
    error: loadedPath === path ? error : "",
    loading: !!path && (loading || loadedPath !== path),
    refreshing:
      !!path && (loading || loadedPath !== path || loadedRevision !== revision),
    reload: () => {
      setLoading(true);
      setRetry((x) => x + 1);
    },
  };
}

import { useState, useRef, useEffect } from "react";
import {
  Outlet,
  NavLink,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  Files,
  ClipboardCheck,
  KeyRound,
  History,
  Settings,
  CircleHelp,
  Bell,
  Search,
  Building2,
  LogOut,
  Menu,
  Plus,
} from "lucide-react";
import { api, label } from "../services/api";
import type { Dashboard, Notifications } from "../services/api";
import { useSession, useResource } from "../services/session";
import { ErrorBox, DateText, useAction } from "./common/UI";
export default function Layout() {
  const { user, logout, refresh, live } = useSession(),
    navigate = useNavigate(),
    location = useLocation();
  const p = user!,
    [query, setQuery] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    [bell, setBell] = useState(false),
    [account, setAccount] = useState(false);
  const [hits, setHits] = useState<
      { label: string; kind: string; link: string }[]
    >([]),
    [searchError, setSearchError] = useState(""),
    [searching, setSearching] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null),
    notificationBox = useRef<HTMLDivElement>(null),
    accountBox = useRef<HTMLDivElement>(null),
    action = useAction();
  const { data: dash } = useResource<Dashboard>("/dashboard"),
    { data: notifications } = useResource<Notifications>("/notifications");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setHits([]);
        return;
      }
      setSearching(true);
      api<typeof hits>("/search?q=" + encodeURIComponent(query))
        .then((r) => {
          if (active) {
            setHits(r);
            setSearchError("");
          }
        })
        .catch((e) => {
          if (active) setSearchError(e.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    drawer.current?.close();
    // eslint-disable-next-line react/set-state-in-effect -- Navigation dismisses transient menus alongside the native dialog.
    setBell(false);
    setAccount(false);
    setShowSearch(false);
  }, [location.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!notificationBox.current?.contains(e.target as Node)) setBell(false);
      if (!accountBox.current?.contains(e.target as Node)) setAccount(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const root = "/" + p.role.toLowerCase();
  const items =
    p.role === "OWNER"
      ? ([
          ["/owner/dashboard", "Dashboard", LayoutDashboard],
          ["/owner/documents", "My Documents", Files],
          ["/owner/requests", "Verification Requests", ClipboardCheck],
          ["/owner/consent", "Consent Rules", KeyRound],
          ["/audit", "Audit Log", History],
        ] as const)
      : p.role === "ISSUER"
        ? ([
            ["/issuer/dashboard", "Dashboard", LayoutDashboard],
            ["/issuer/issue", "Issue Credential", Plus],
            ["/issuer/documents", "Issued Credentials", Files],
            ["/issuer/registry", "Organisation / Registry", Building2],
            ["/audit", "Audit Log", History],
          ] as const)
        : ([
            ["/verifier/dashboard", "Dashboard", LayoutDashboard],
            ["/verifier/new", "New Verification", Plus],
            ["/verifier/history", "Verification History", History],
            ["/verifier/organization", "Organisation / API Access", Building2],
          ] as const);
  const navigation = (
    <>
      <Link className="brand" to={root + "/dashboard"}>
        <ShieldCheck size={30} />
        <span>
          CredVault<small>Credential workspace</small>
        </span>
      </Link>
      <div className="nav-caption">{label(p.role)} portal</div>
      <nav aria-label="Main navigation">
        {items.map(([path, title, Icon]) => (
          <NavLink key={path} to={path}>
            <Icon size={18} />
            <span>{title}</span>
            {path === "/owner/requests" && !!dash?.pending && (
              <span className="count">{dash.pending}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="nav-bottom">
        <NavLink to="/settings">
          <Settings size={18} />
          Settings
        </NavLink>
        <NavLink to="/help">
          <CircleHelp size={18} />
          Help
        </NavLink>
        <button
          onClick={() => void action.run(logout, "Signed out")}
          disabled={action.busy}
        >
          <LogOut size={18} />
          Log out
        </button>
        <small>
          Server-enforced consent
          <br />
          Encrypted storage · Signed claims
        </small>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{navigation}</aside>
      <dialog className="mobile-drawer" ref={drawer} aria-label="Navigation">
        <button className="secondary" onClick={() => drawer.current?.close()}>
          Close navigation
        </button>
        {navigation}
      </dialog>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu />
          </button>
          <div
            className="global-search"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setShowSearch(false);
            }}
          >
            <Search size={18} />
            <input
              aria-label="Search your workspace"
              placeholder="Search your workspace…"
              value={query}
              onFocus={() => setShowSearch(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSearch(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSearch(false);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  e.currentTarget.parentElement
                    ?.querySelector<HTMLAnchorElement>(".search-results a")
                    ?.focus();
                }
              }}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setHits([]);
                }}
              >
                ×
              </button>
            )}
            {showSearch && query.length >= 2 && (
              <div className="search-results">
                <ErrorBox message={searchError} />
                {searching ? (
                  <p>Searching…</p>
                ) : hits.length ? (
                  hits.map((h, i) => (
                    <Link
                      key={h.link}
                      to={h.link}
                      onKeyDown={(e) => {
                        const links =
                          e.currentTarget.parentElement?.querySelectorAll("a");
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          links?.[Math.min(i + 1, hits.length - 1)]?.focus();
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          links?.[Math.max(i - 1, 0)]?.focus();
                        }
                        if (e.key === "Escape") setShowSearch(false);
                      }}
                    >
                      <small>{label(h.kind)}</small>
                      {h.label}
                    </Link>
                  ))
                ) : (
                  <p>No matching records.</p>
                )}
              </div>
            )}
          </div>
          <div className="header-actions">
            <div className="popover-anchor" ref={notificationBox}>
              <button
                className="icon-button"
                aria-label={
                  "Notifications, " + (notifications?.unread || 0) + " unread"
                }
                aria-expanded={bell}
                onClick={() => setBell(!bell)}
              >
                <Bell size={20} />
                {!!notifications?.unread && (
                  <span className="notification-count">
                    {notifications.unread}
                  </span>
                )}
              </button>
              {bell && (
                <section
                  className="popover"
                  aria-label="Notifications"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setBell(false);
                  }}
                >
                  <div className="dialog-head">
                    <h2>Notifications</h2>
                    <button
                      className="text-button"
                      disabled={action.busy || !notifications?.unread}
                      onClick={() =>
                        void action.run(async () => {
                          await api("/notifications/all/read", "POST");
                          refresh();
                        }, "Marked as read")
                      }
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications?.items.length ? (
                    notifications.items.map((n) => (
                      <button
                        className={"notification " + (n.read ? "" : "unread")}
                        key={n.id}
                        onClick={() =>
                          void action.run(async () => {
                            await api(
                              "/notifications/" + n.id + "/read",
                              "POST",
                            );
                            navigate(n.link);
                          }, "")
                        }
                      >
                        <span>{n.message}</span>
                        <small>
                          <DateText value={n.created_at} />
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>No notifications yet.</p>
                  )}
                </section>
              )}
            </div>
            <div className="popover-anchor" ref={accountBox}>
              <button
                className="account"
                aria-label={"Account menu for " + p.name}
                aria-expanded={account}
                onClick={() => setAccount(!account)}
              >
                <span className="avatar">{p.name.slice(0, 1)}</span>
                <span className="account-name">
                  {p.name}
                  <small>{label(p.role)}</small>
                </span>
              </button>
              {account && (
                <div className="popover account-popover">
                  <strong>{p.name}</strong>
                  <p>{p.organization?.name || "Personal vault"}</p>
                  <Link to="/settings">Account settings</Link>
                  <button
                    className="secondary"
                    disabled={action.busy}
                    onClick={() => void action.run(logout)}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <ErrorBox message={action.error} />
          <Outlet key={p.id} />
        </main>
        <footer className="workspace-footer">
          CredVault ·{" "}
          {live ? "Live updates connected" : "Reconnecting · polling fallback"}{" "}
          <span>{p.timezone}</span>
        </footer>
      </div>
    </div>
  );
}

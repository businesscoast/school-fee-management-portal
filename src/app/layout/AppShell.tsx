import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { formatDate } from "../../domain/dates";
import { summarize } from "../../domain/metrics";
import { useAuth } from "../../store/auth";
import { useStore } from "../../store/store";
import { initials } from "../format";
import {
  IconAlerts,
  IconChevron,
  IconClasses,
  IconCollections,
  IconDashboard,
  IconImport,
  IconLogo,
  IconMenu,
  IconReports,
  IconSearch,
  IconSettings,
  IconStudents,
} from "../components/Icons";
import { StudentDrawerProvider } from "../components/StudentDrawer";

interface NavItem {
  to: string;
  end?: boolean;
  label: string;
  Icon: typeof IconDashboard;
}

const NAV_GROUPS: { caption: string; hint?: string; items: NavItem[] }[] = [
  {
    caption: "Navigation",
    items: [
      { to: "/app", end: true, label: "Dashboard", Icon: IconDashboard },
      { to: "/app/alerts", label: "Alerts & follow-ups", Icon: IconAlerts },
    ],
  },
  {
    caption: "Fee records",
    hint: "Students, classes and history",
    items: [
      { to: "/app/students", label: "Students", Icon: IconStudents },
      { to: "/app/classes", label: "Class-wise", Icon: IconClasses },
      { to: "/app/collections", label: "Collections", Icon: IconCollections },
    ],
  },
  {
    caption: "Data",
    hint: "Import, reports and settings",
    items: [
      { to: "/app/import", label: "Import records", Icon: IconImport },
      { to: "/app/reports", label: "Reports", Icon: IconReports },
      { to: "/app/settings", label: "Settings", Icon: IconSettings },
    ],
  },
];

function titleFor(pathname: string): string {
  if (pathname === "/app" || pathname === "/app/")
    return "Principal's dashboard";
  if (pathname.startsWith("/app/students/")) return "Student fee profile";
  if (pathname.startsWith("/app/students")) return "Students";
  if (pathname.startsWith("/app/import")) return "Import existing records";
  if (pathname.startsWith("/app/alerts")) return "Alerts & follow-ups";
  if (pathname.startsWith("/app/classes")) return "Class-wise fee overview";
  if (pathname.startsWith("/app/collections")) return "Collection overview";
  if (pathname.startsWith("/app/reports")) return "Reports";
  if (pathname.startsWith("/app/settings")) return "Academic years & settings";
  return "School Fee Intelligence";
}

function crumbFor(pathname: string): string {
  if (pathname === "/app" || pathname === "/app/") return "Dashboard";
  if (pathname.startsWith("/app/students/")) return "Student profile";
  if (pathname.startsWith("/app/students")) return "Students";
  if (pathname.startsWith("/app/import")) return "Import records";
  if (pathname.startsWith("/app/alerts")) return "Alerts";
  if (pathname.startsWith("/app/classes")) return "Class-wise";
  if (pathname.startsWith("/app/collections")) return "Collections";
  if (pathname.startsWith("/app/reports")) return "Reports";
  if (pathname.startsWith("/app/settings")) return "Settings";
  return "";
}

export function AppShell() {
  const store = useStore();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = auth.user ?? {
    name: "Principal",
    email: "",
    role: "Principal",
    signedInAt: "",
  };

  // Close the user menu on outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  const summary = useMemo(() => summarize(store.views), [store.views]);
  const alertCount = summary.overdue + summary.dueWithin3;
  const yearNote =
    store.year === store.data.currentYear
      ? "Current year."
      : store.year < store.data.currentYear
        ? "Historical records."
        : "Future year.";

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`.trim()}>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="School Fee Intelligence home">
          <span className="brand-mark">
            <IconLogo size={22} />
          </span>
          <span>
            <span className="brand-name">School Fee Intelligence</span>
            <br />
            <span className="brand-sub">{store.data.schoolName}</span>
          </span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.caption} className="nav-group">
              <div className="nav-caption">
                {group.caption}
                {group.hint ? <small>{group.hint}</small> : null}
              </div>
              {group.items.map(({ to, end, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => (isActive ? "active" : "")}
                  title={label}
                >
                  <Icon size={18} />
                  <span className="lbl">{label}</span>
                  {to === "/app/alerts" && alertCount > 0 ? (
                    <span className="count">{alertCount}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>Academic year {store.year}</strong>
          <p>
            {yearNote} Running on generated sample data; try the import wizard
            with a sample file.
          </p>
          <Link to="/app/import" className="btn sm">
            Upload records
          </Link>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn menu"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={collapsed}
          >
            <IconMenu size={18} />
          </button>
          <div className="title">
            <h1>{titleFor(location.pathname)}</h1>
            <div className="crumb-row">
              <ol className="crumbs" aria-label="Breadcrumb">
                <li>
                  <Link to="/app">Home</Link>
                </li>
                <li>{crumbFor(location.pathname)}</li>
                <li>{store.year}</li>
              </ol>
              <span className="date-chip">
                Today · {formatDate(store.today)}
              </span>
            </div>
          </div>
          <div className="topbar-tools">
            <div className="year-pick">
              <label htmlFor="year-select">Academic year</label>
              <select
                id="year-select"
                value={store.year}
                onChange={(e) => store.setYear(e.target.value)}
              >
                {store.data.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {y === store.data.currentYear ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <form
              className="topbar-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/app/students?q=${encodeURIComponent(q.trim())}`);
              }}
            >
              <IconSearch size={17} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a student or class"
                aria-label="Search students"
              />
            </form>
            <button
              type="button"
              className="bell"
              onClick={() => navigate("/app/alerts?tab=overdue")}
              aria-label={
                alertCount > 0
                  ? `Alerts: ${alertCount} students overdue or due within 3 days`
                  : "Alerts"
              }
              title="Alerts & follow-ups"
            >
              <IconAlerts size={18} />
              {alertCount > 0 ? (
                <span className="dot">{alertCount}</span>
              ) : null}
            </button>
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-block"
                onClick={() => setMenu((m) => !m)}
                aria-haspopup="menu"
                aria-expanded={menu}
                aria-label={`Account: ${user.name}, ${user.role}`}
              >
                <span className="user-avatar" aria-hidden="true">
                  {initials(user.name)}
                </span>
                <span className="u-text">
                  <span className="u-name">{user.name}</span>
                  <br />
                  <span className="u-role">{user.role}</span>
                </span>
                <IconChevron size={14} className="u-caret" />
              </button>
              {menu ? (
                <div className="user-pop" role="menu" aria-label="Account">
                  <div className="who">
                    <strong>{user.name}</strong>
                    <span className="muted small">
                      {user.email || user.role}
                    </span>
                  </div>
                  <Link
                    to="/app/settings"
                    role="menuitem"
                    onClick={() => setMenu(false)}
                  >
                    Academic years &amp; settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      auth.signOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <StudentDrawerProvider>
          <Outlet />
        </StudentDrawerProvider>
      </main>
    </div>
  );
}

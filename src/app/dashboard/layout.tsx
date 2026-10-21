"use client";

import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { authedFetch } from "@/lib/apiClient";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Wallet,
  Calendar as CalendarIcon,
  Bell,
  Building2,
  ShieldCheck,
  UserCheck,
  Menu,
  X,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Chip } from "@/components/ui";
import { motion } from "framer-motion";

type Persona = "user" | "organization";
const PERSONAS: Persona[] = ["user", "organization"];

/**
 * Switches between the "user" and "organization" personas.
 *
 * This used to write `role` straight to Firestore from the browser for a third
 * option too — `admin` — which `firestore.rules` rejects outright. The failure
 * was swallowed by a bare `console.error`, so the button silently did nothing
 * while still advertising an escalation path.
 *
 * Two changes: `admin` is gone from this control (it is granted server-side
 * only, from the allow-list, via `POST /api/admin/resolve-role`), and the write
 * goes through `POST /api/account/role`, which is the only path that can
 * actually persist a role change for a non-admin.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, profile, refreshProfile, loading } = useAuth();
  const { unreadCount } = useNotifications(currentUser?.uid);
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [switchingRole, setSwitchingRole] = useState(false);

  // Fallback to "user" if not set
  const currentRole = profile?.role || "user";

  const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Opportunity Wallet", href: "/dashboard/wallet", icon: Wallet },
    { name: "Calendar Hub", href: "/dashboard/calendar", icon: CalendarIcon },
    {
      name: "Notifications",
      href: "/dashboard/notifications",
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      name: "Org Dashboard",
      href: "/dashboard/organization",
      icon: Building2,
      roleRequired: "organization",
    },
    {
      name: "Admin Panel",
      href: "/dashboard/admin",
      icon: ShieldCheck,
      roleRequired: "admin",
    },
  ];

  const handleRoleChange = async (role: Persona) => {
    if (switchingRole) return;
    setRoleError("");
    setSwitchingRole(true);
    try {
      const res = await authedFetch("/api/account/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Could not switch role (${res.status})`);

      await refreshProfile();
      router.push(role === "organization" ? "/dashboard/organization" : "/dashboard");
    } catch (err) {
      console.error("Failed to update role:", err);
      setRoleError(err instanceof Error ? err.message : "Could not switch role.");
    } finally {
      setSwitchingRole(false);
    }
  };

  if (loading) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="hidden shrink-0 space-y-6 border-r border-border bg-surface p-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
        <SidebarHeader />
        <RoleSwitcher
          currentRole={currentRole}
          switching={switchingRole}
          error={roleError}
          onChange={handleRoleChange}
        />
        <NavList
          items={navigation}
          pathname={pathname}
          currentRole={currentRole}
          onNavigate={undefined}
        />
        <SidebarFooter />
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-grow flex-col">
        {/* Mobile Header Nav */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-surface/90 px-5 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-sm bg-surface-ink text-background">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-base text-foreground">NEXORA</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            className="grid h-9 w-9 place-items-center rounded-md text-foreground-muted transition-colors duration-fast hover:bg-surface-raised hover:text-foreground"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile Sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex bg-foreground/20 backdrop-blur-sm lg:hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full w-72 flex-col space-y-6 overflow-y-auto border-r border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="flex items-center gap-2 font-display text-base text-foreground">
                  <Sparkles className="h-4 w-4 text-secondary" /> NEXORA
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="grid h-8 w-8 place-items-center rounded-md text-foreground-muted transition-colors duration-fast hover:bg-surface-raised hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <RoleSwitcher
                currentRole={currentRole}
                switching={switchingRole}
                error={roleError}
                onChange={(r) => {
                  handleRoleChange(r);
                  setMobileOpen(false);
                }}
              />

              <NavList
                items={navigation}
                pathname={pathname}
                currentRole={currentRole}
                onNavigate={() => setMobileOpen(false)}
              />

              <SidebarFooter onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces --
 * These live outside the layout component on purpose. Declaring them inside the
 * render body made React recreate the component type on every pass, which reset
 * their state and re-triggered their mount effects; it also meant the desktop
 * and mobile copies of the nav could silently drift apart.
 * -------------------------------------------------------------------------- */

function SidebarHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-ink text-background">
        <Sparkles className="h-4.5 w-4.5" />
      </span>
      <div>
        <h4 className="font-display text-lg leading-none text-foreground">NEXORA</h4>
        <span className="eyebrow mt-1">Student Intelligence Hub</span>
      </div>
    </div>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <ThemeToggle />
      <Link
        href="/"
        onClick={onNavigate}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors duration-base hover:bg-surface-raised hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Site</span>
      </Link>
    </div>
  );
}

interface RoleSwitcherProps {
  currentRole: string;
  switching: boolean;
  error: string;
  onChange: (role: Persona) => void;
}

function RoleSwitcher({ currentRole, switching, error, onChange }: RoleSwitcherProps) {
  return (
    <div className="card-raised space-y-3 p-4">
      <span className="eyebrow flex items-center gap-1.5">
        <UserCheck className="h-3.5 w-3.5" />
        Active Persona Role
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {PERSONAS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={switching}
            onClick={() => onChange(r)}
            aria-pressed={currentRole === r}
            className={`rounded-sm border px-1 py-1.5 text-2xs font-semibold capitalize transition-colors duration-fast disabled:opacity-50 ${
              currentRole === r
                ? "border-transparent bg-surface-ink text-background"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
            }`}
          >
            {r === "organization" ? "Org" : r}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs leading-relaxed text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  roleRequired?: string;
}

interface NavListProps {
  items: NavItem[];
  pathname: string;
  currentRole: string;
  onNavigate?: () => void;
}

function NavList({ items, pathname, currentRole, onNavigate }: NavListProps) {
  return (
    <nav className="flex-1 space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const hasAccess = !item.roleRequired || currentRole === item.roleRequired;
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`group flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-base ${
              isActive
                ? "bg-surface-ink text-background"
                : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
            } ${hasAccess ? "" : "opacity-50 hover:opacity-100"}`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              <span className={isActive ? "font-semibold" : "font-medium"}>{item.name}</span>
            </span>
            <span className="flex items-center gap-2">
              {item.roleRequired && currentRole !== item.roleRequired && (
                <Chip className="text-2xs">{item.roleRequired}</Chip>
              )}
              {item.badge !== undefined && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-2xs font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
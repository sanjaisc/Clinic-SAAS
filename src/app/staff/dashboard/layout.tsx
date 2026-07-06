"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  Users,
  Clock,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Building2,
  ShieldCheck,
  BarChart3,
  Activity,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DoctALogo } from "@/components/docta-logo";
import type { DoctASessionUser } from "@/lib/auth";
import { hasMinimumRole, STAFF_ROLE } from "@/lib/enums";
import { NotificationBell } from "@/components/notification-bell";

const NAV_ITEMS = [
  {
    href: "/staff/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    minRole: STAFF_ROLE.CLINIC_RECEPTION,
  },
  {
    href: "/staff/dashboard/calendar",
    label: "Calendar",
    icon: CalendarDays,
    minRole: STAFF_ROLE.CLINIC_RECEPTION,
  },
  {
    href: "/staff/dashboard/book",
    label: "Manual Booking",
    icon: CalendarPlus,
    minRole: STAFF_ROLE.CLINIC_RECEPTION,
  },
  {
    href: "/staff/dashboard/appointments",
    label: "Appointments",
    icon: Clock,
    minRole: STAFF_ROLE.CLINIC_RECEPTION,
  },
  {
    href: "/staff/dashboard/activity",
    label: "Activity",
    icon: Activity,
    minRole: STAFF_ROLE.CLINIC_RECEPTION,
  },
  {
    href: "/staff/dashboard/slots",
    label: "Slot Management",
    icon: Clock,
    minRole: STAFF_ROLE.CLINIC_ADMIN,
  },
  {
    href: "/staff/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    minRole: STAFF_ROLE.CLINIC_ADMIN,
  },
  {
    href: "/staff/dashboard/admin",
    label: "Admin",
    icon: Shield,
    minRole: STAFF_ROLE.SYSTEM_MANAGER,
  },
  {
    href: "/staff/dashboard/settings",
    label: "Settings",
    icon: Settings,
    minRole: STAFF_ROLE.CLINIC_ADMIN,
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case STAFF_ROLE.SYSTEM_MANAGER:
      return "bg-purple-100 text-purple-700 border-purple-200";
    case STAFF_ROLE.CLINIC_ADMIN:
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-sky-100 text-sky-700 border-sky-200";
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case STAFF_ROLE.SYSTEM_MANAGER:
      return "System Manager";
    case STAFF_ROLE.CLINIC_ADMIN:
      return "Clinic Admin";
    default:
      return "Receptionist";
  }
}

export default function StaffDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = "/staff/login";
    },
  });
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user as DoctASessionUser | undefined;

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const filteredNav = NAV_ITEMS.filter((item) =>
    hasMinimumRole(user.role, item.minRole)
  );

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo section */}
      <div className="p-4 flex items-center shrink-0">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <DoctALogo height={28} />
        </Link>
      </div>

      {/* Clinic badge */}
      {user.clinicId && !collapsed && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
            <Building2 className="size-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-medium text-emerald-700 truncate">
              {user.name.split(" Admin")[0].split(" Reception")[0]}
            </span>
          </div>
        </div>
      )}

      <Separator className="mx-3 w-auto" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {filteredNav.map((item) => {
          const isActive =
            item.href === "/staff/dashboard"
              ? pathname === "/staff/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <TooltipProvider key={item.href} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavClick(item.href)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-150 cursor-pointer group relative
                      ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }
                      ${collapsed ? "justify-center" : ""}
                    `}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-500" />
                    )}
                    <Icon
                      className={`size-4.5 shrink-0 ${
                        isActive ? "text-emerald-600" : "text-muted-foreground/70 group-hover:text-foreground"
                      }`}
                    />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </nav>

      {/* User section */}
      <div className="shrink-0 p-3 space-y-2">
        <Separator className="mb-3 w-auto" />
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar className="size-9 border-2 border-emerald-200">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.name}
              </p>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${getRoleBadgeColor(user.role)}`}
              >
                {getRoleLabel(user.role)}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Avatar className="size-9 border-2 border-emerald-200">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col border-r border-border/60 bg-background
          transition-all duration-300 ease-in-out shrink-0
          ${collapsed ? "w-[72px]" : "w-[260px]"}
        `}
      >
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-4 -right-3.5 size-7 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors cursor-pointer z-10"
          style={{ left: collapsed ? "calc(72px - 14px)" : "calc(260px - 14px)" }}
        >
          <ChevronLeft
            className={`size-3.5 text-muted-foreground transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] bg-background border-r border-border/60
          transform transition-transform duration-300 ease-in-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="h-14 border-b border-border/60 bg-background flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden cursor-pointer"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span className="text-sm font-medium text-foreground">
                Staff Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-border/60">
              <Avatar className="size-7 border border-emerald-200">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground font-medium">
                {user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
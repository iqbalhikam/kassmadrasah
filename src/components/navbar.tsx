"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Wallet,
  LayoutDashboard,
  Tags,
  Settings,
  LogOut,
  RefreshCw,
  School,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  madrasahName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Navbar({ madrasahName = "MA Universal", onRefresh, isRefreshing }: NavbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/categories", label: "Kategori", icon: Tags },
    { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand logo & Madrasah title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-lg shadow-emerald-500/20">
            <School className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-lg tracking-tight">Kas Madrasah</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                <Database className="h-3 w-3" /> Drive-Synced
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
              {madrasahName}
            </p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800/80">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile & Action buttons */}
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Sinkronkan data dengan Google Sheets"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-emerald-400")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {session?.user && (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="h-8 w-8 rounded-full border border-emerald-500/30 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {session.user.name?.charAt(0) || "U"}
                </div>
              )}
              <div className="hidden lg:block text-left text-xs">
                <p className="font-semibold text-slate-200 leading-tight">{session.user.name}</p>
                <p className="text-slate-400 truncate max-w-[120px]">{session.user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Keluar dari sesi"
                className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex md:hidden border-t border-slate-800/80 bg-slate-950/80 px-4 py-2 justify-around">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                isActive ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Tags,
  Settings,
  LogOut,
  RefreshCw,
  FileText,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface NavbarProps {
  madrasahName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Navbar({ madrasahName = "MI Islamiyah Sumberharjo", onRefresh, isRefreshing }: NavbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/categories", label: "Kategori", icon: Tags },
    { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
    { href: "/report", label: "Laporan PDF", icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Brand logo & Madrasah title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl overflow-hidden bg-white shadow-md shadow-emerald-500/10 border border-emerald-500/20 shrink-0">
            <Image
              src="/logo/logo.jpeg"
              alt="Logo Madrasah"
              width={40}
              height={40}
              className="object-contain w-full h-full p-0.5"
              priority
            />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-sm sm:text-base tracking-tight leading-none truncate">
                Kas Madrasah
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden xs:inline">Drive-Synced</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[130px] xs:max-w-[170px] sm:max-w-xs mt-0.5">
              {madrasahName}
            </p>
          </div>
        </div>

        {/* Desktop Navigation items */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Sinkronkan data dengan Google Sheets"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-emerald-400", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {session?.user && (
            <div className="flex items-center gap-2 border-l border-slate-800/80 pl-2.5 sm:pl-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="h-8 w-8 rounded-full border border-emerald-500/30 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-xs font-bold text-white shadow-md">
                  {session.user.name?.charAt(0) || "U"}
                </div>
              )}
              <div className="hidden lg:block text-left text-xs">
                <p className="font-semibold text-slate-200 leading-tight">{session.user.name}</p>
                <p className="text-slate-400 truncate max-w-[120px]">{session.user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Keluar dari akun"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="grid grid-cols-4 md:hidden border-t border-slate-800/60 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 gap-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-medium transition-all duration-150",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-emerald-400" : "text-slate-400")} />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}


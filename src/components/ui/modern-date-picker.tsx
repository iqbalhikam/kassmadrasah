"use client";

import React, {
  useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect,
} from "react";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types -------------------------------------------------------------------

export interface ModernDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  size?: "sm" | "md";
  accentColor?: "emerald" | "violet" | "indigo";
  id?: string;
  name?: string;
  required?: boolean;
  allowClear?: boolean;
  minDate?: string;
  maxDate?: string;
  quickPresets?: boolean;
}

type AccentColor = NonNullable<ModernDatePickerProps["accentColor"]>;
type Size       = NonNullable<ModernDatePickerProps["size"]>;
type ViewMode   = "calendar" | "month" | "year";

interface CalendarDay {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
}

// --- Constants ---------------------------------------------------------------

const MONTH_NAMES_ID = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
] as const;

const MONTH_SHORT_ID = [
  "Jan","Feb","Mar","Apr","Mei","Jun",
  "Jul","Agu","Sep","Okt","Nov","Des",
] as const;

const DAY_NAMES_ID = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"] as const;

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg min-h-[34px]",
  md: "px-3 py-2.5 text-sm rounded-xl min-h-[42px]",
};

const ACCENT_SELECTED_BG: Record<AccentColor, string> = {
  emerald: "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 hover:bg-emerald-500",
  violet:  "bg-violet-600 text-white font-bold shadow-md shadow-violet-600/30 hover:bg-violet-500",
  indigo:  "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 hover:bg-indigo-500",
};

const ACCENT_MONTH_ACTIVE: Record<AccentColor, string> = {
  emerald: "bg-emerald-600 text-white",
  violet:  "bg-violet-600 text-white",
  indigo:  "bg-indigo-600 text-white",
};

const ACCENT_HEADER_TEXT: Record<AccentColor, string> = {
  emerald: "text-emerald-400",
  violet:  "text-violet-400",
  indigo:  "text-indigo-400",
};

// --- Helpers -----------------------------------------------------------------

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  if (isNaN(year) || isNaN(month)) return null;
  return { year, month };
}

function formatToIdDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day   = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return dateStr;
  return `${DAY_NAMES_ID[d.getDay()]}, ${day} ${MONTH_NAMES_ID[month]} ${year}`;
}

function buildCalendarDays(viewYear: number, viewMonth: number): CalendarDay[] {
  const firstDay    = new Date(viewYear, viewMonth, 1);
  const lastDay     = new Date(viewYear, viewMonth + 1, 0);
  const startDow    = firstDay.getDay();
  const totalDays   = lastDay.getDate();
  const prevLastDay = new Date(viewYear, viewMonth, 0).getDate();

  const prev: CalendarDay[] = Array.from({ length: startDow }, (_, i) => {
    const day = prevLastDay - (startDow - 1 - i);
    return { day, dateStr: toIsoDate(new Date(viewYear, viewMonth - 1, day)), isCurrentMonth: false };
  });
  const curr: CalendarDay[] = Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    return { day, dateStr: toIsoDate(new Date(viewYear, viewMonth, day)), isCurrentMonth: true };
  });
  const filled    = prev.length + curr.length;
  const remaining = filled % 7 === 0 ? 0 : 7 - (filled % 7);
  const next: CalendarDay[] = Array.from({ length: remaining }, (_, i) => {
    const day = i + 1;
    return { day, dateStr: toIsoDate(new Date(viewYear, viewMonth + 1, day)), isCurrentMonth: false };
  });
  return [...prev, ...curr, ...next];
}

// --- Component ---------------------------------------------------------------

export function ModernDatePicker({
  value,
  onChange,
  placeholder    = "Pilih Tanggal",
  disabled       = false,
  className      = "",
  buttonClassName = "",
  size           = "md",
  accentColor    = "emerald",
  id,
  name,
  required       = false,
  allowClear     = false,
  minDate,
  maxDate,
  quickPresets   = true,
}: ModernDatePickerProps) {

  const [isOpen,   setIsOpen]   = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [dropUp,   setDropUp]   = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const triggerRef   = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view date
  const initialDate = useMemo<Date>(() => {
    if (value) {
      const parsed = parseYearMonth(value);
      if (parsed) {
        const day = parseInt(value.split("-")[2], 10);
        if (!isNaN(day)) return new Date(parsed.year, parsed.month, day);
      }
    }
    return new Date();
  }, [value]);

  const [viewYear,  setViewYear]  = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  const [yearPage,  setYearPage]  = useState<number>(Math.floor(initialDate.getFullYear() / 12));
  const [prevValue, setPrevValue] = useState<string>(value);

  // Sync view when value changes externally (derived state pattern)
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const parsed = parseYearMonth(value);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }

  const todayStr = useMemo<string>(() => toIsoDate(new Date()), []);

  const close = useCallback(() => { setIsOpen(false); setViewMode("calendar"); }, []);
  const open  = useCallback(() => { if (disabled) return; setViewMode("calendar"); setIsOpen(true); }, [disabled]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Calculate drop direction on desktop
  useLayoutEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return;
    const rect       = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setDropUp(spaceBelow < 340 && spaceAbove > spaceBelow);
  }, [isOpen, isMobile]);

  // Body scroll lock on mobile
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, isMobile]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, close]);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isOpen && e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDate = (dateStr: string) => { onChange(dateStr); close(); };

  const calendarDays    = useMemo<CalendarDay[]>(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const accentSelectedBg = ACCENT_SELECTED_BG[accentColor];
  const accentMonthBg   = ACCENT_MONTH_ACTIVE[accentColor];
  const accentHeaderTxt = ACCENT_HEADER_TEXT[accentColor];
  const yearGridStart   = yearPage * 12;
  const yearGridItems   = Array.from({ length: 12 }, (_, i) => yearGridStart + i);

  const popupContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pilih tanggal"
      className={cn(
        "bg-slate-900 border border-slate-700/80 shadow-2xl",
        isMobile ? "rounded-t-3xl" : "rounded-2xl",
      )}
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>
      )}

      <div className="p-3.5 sm:p-4">
        {/* Quick Presets */}
        {quickPresets && viewMode === "calendar" && (
          <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-slate-800 overflow-x-auto">
            {[
              { label: "Hari Ini",   date: todayStr },
              { label: "Kemarin",    date: (() => { const d = new Date(); d.setDate(d.getDate()-1); return toIsoDate(d); })() },
              { label: "Awal Bulan", date: toIsoDate(new Date(viewYear, viewMonth, 1)) },
            ].map(({ label, date }) => (
              <button
                key={label}
                type="button"
                onClick={() => selectDate(date)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition shrink-0 active:scale-95",
                  value === date
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Header navigation */}
        <div className="flex items-center justify-between mb-3">
          {(viewMode === "calendar" || viewMode === "year") ? (
            <button
              type="button"
              onClick={viewMode === "calendar" ? prevMonth : () => setYearPage(p => p - 1)}
              aria-label={viewMode === "calendar" ? "Bulan sebelumnya" : "Rentang tahun sebelumnya"}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-90"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : <div className="w-9" />}

          {/* Clickable center label */}
          <button
            type="button"
            onClick={() => {
              if (viewMode === "calendar")  setViewMode("month");
              else if (viewMode === "month") setViewMode("year");
              else setViewMode("calendar");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-800 transition group"
          >
            <span className="text-sm font-bold text-slate-100 group-hover:text-white">
              {viewMode === "year"
                ? `${yearGridStart} \u2013 ${yearGridStart + 11}`
                : viewMode === "month"
                ? viewYear
                : MONTH_NAMES_ID[viewMonth]}
            </span>
            {viewMode === "calendar" && (
              <span className={cn("text-sm font-bold", accentHeaderTxt)}>{viewYear}</span>
            )}
            <ChevronUp
              className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                viewMode === "calendar" ? "rotate-180" : "",
              )}
            />
          </button>

          {(viewMode === "calendar" || viewMode === "year") ? (
            <button
              type="button"
              onClick={viewMode === "calendar" ? nextMonth : () => setYearPage(p => p + 1)}
              aria-label={viewMode === "calendar" ? "Bulan berikutnya" : "Rentang tahun berikutnya"}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-90"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : <div className="w-9" />}
        </div>

        {/* Year picker */}
        {viewMode === "year" && (
          <div key="year" className="grid grid-cols-4 gap-1.5 animate-view-switch">
            {yearGridItems.map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => { setViewYear(yr); setYearPage(Math.floor(yr / 12)); setViewMode("month"); }}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-semibold transition active:scale-95",
                  viewYear === yr
                    ? accentMonthBg
                    : new Date().getFullYear() === yr
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                {yr}
              </button>
            ))}
          </div>
        )}

        {/* Month picker */}
        {viewMode === "month" && (
          <div key="month" className="grid grid-cols-3 gap-1.5 animate-view-switch">
            {MONTH_SHORT_ID.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => { setViewMonth(i); setViewMode("calendar"); }}
                className={cn(
                  "py-3 rounded-xl text-xs font-semibold transition active:scale-95",
                  viewMonth === i ? accentMonthBg : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Calendar grid */}
        {viewMode === "calendar" && (
          <div key="calendar" className="animate-view-switch">
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_NAMES_ID.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "text-[10px] font-bold py-1 text-center select-none",
                    i === 0 || i === 6 ? "text-rose-400/80" : "text-slate-500",
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((item, idx) => {
                const isSelected = item.dateStr === value;
                const isToday    = item.dateStr === todayStr;
                const isDisabled = Boolean(
                  (minDate && item.dateStr < minDate) ||
                  (maxDate && item.dateStr > maxDate),
                );
                return (
                  <button
                    key={`${item.dateStr}_${idx}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(item.dateStr)}
                    aria-label={item.dateStr}
                    aria-pressed={isSelected}
                    className={cn(
                      "w-full rounded-xl text-xs flex items-center justify-center transition select-none relative",
                      "min-h-[40px] sm:min-h-[36px] active:scale-90",
                      isDisabled
                        ? "opacity-20 cursor-not-allowed text-slate-600"
                        : isSelected
                          ? accentSelectedBg
                          : !item.isCurrentMonth
                            ? "text-slate-600 hover:bg-slate-800/40 hover:text-slate-400"
                            : "text-slate-200 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <span>{item.day}</span>
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-500" />
            Hari ini: <span className="font-mono text-slate-300 ml-1">{todayStr}</span>
          </span>
          <button
            type="button"
            onClick={close}
            className="text-xs text-slate-400 hover:text-slate-200 font-medium px-2.5 py-1 rounded-lg hover:bg-slate-800 transition active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {name && <input type="hidden" name={name} value={value} required={required} />}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => isOpen ? close() : open()}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          "w-full flex items-center justify-between gap-2 border bg-slate-950 text-left transition select-none",
          SIZE_CLASSES[size],
          isOpen ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-slate-800 hover:border-slate-700",
          disabled ? "opacity-50 cursor-not-allowed bg-slate-900" : "cursor-pointer",
          buttonClassName,
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className={cn("truncate", value ? "text-slate-100 font-medium" : "text-slate-500")}>
            {value ? formatToIdDisplay(value) : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Hapus tanggal"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(""); } }}
              className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </span>
          )}
          <ChevronUp
            className={cn(
              "h-4 w-4 text-slate-500 transition-transform duration-200",
              isOpen ? "" : "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Desktop dropdown */}
      {isOpen && !isMobile && (
        <div
          className={cn(
            "absolute inset-x-0 z-50 w-72 sm:w-[308px]",
            dropUp ? "bottom-full mb-1.5 animate-popup-up" : "top-full mt-1.5 animate-popup-in",
          )}
        >
          {popupContent}
        </div>
      )}

      {/* Mobile bottom sheet + backdrop */}
      {isOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-backdrop-in"
            onClick={close}
          />
          <div className="fixed inset-x-0 bottom-0 z-[9999] animate-sheet-in">
            {popupContent}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";

export interface ModernDatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
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

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function formatToIdDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return dateStr;

  const dayName = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()];
  const monthName = MONTH_NAMES_ID[month] || "";
  return `${dayName}, ${day} ${monthName} ${year}`;
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ModernDatePicker({
  value,
  onChange,
  placeholder = "Pilih Tanggal",
  disabled = false,
  className = "",
  buttonClassName = "",
  size = "md",
  accentColor = "emerald",
  id,
  name,
  required = false,
  allowClear = false,
  minDate,
  maxDate,
  quickPresets = true,
}: ModernDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view date dari value atau tanggal hari ini
  const initialDate = useMemo(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m, d);
        }
      }
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  // Sinkronkan view saat value berubah dari luar
  useEffect(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [value]);

  // Tutup popup saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Tutup dengan tombol Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const todayStr = useMemo(() => toIsoDate(new Date()), []);

  // Hitung grid kalender
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Minggu
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Hari dari bulan sebelumnya untuk padding awal
    const prevMonthDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const d = new Date(viewYear, viewMonth - 1, day);
      prevMonthDays.push({
        day,
        dateStr: toIsoDate(d),
        isCurrentMonth: false,
      });
    }

    // Hari pada bulan saat ini
    const currentDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      currentDays.push({
        day,
        dateStr: toIsoDate(d),
        isCurrentMonth: true,
      });
    }

    // Hari dari bulan berikutnya untuk melengkapi kelipatan 7
    const nextMonthDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    const remainingCells = 42 - (prevMonthDays.length + currentDays.length); // 6 baris x 7 hari
    const countToAdd = remainingCells >= 7 ? remainingCells - 7 : remainingCells;
    for (let day = 1; day <= countToAdd; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      nextMonthDays.push({
        day,
        dateStr: toIsoDate(d),
        isCurrentMonth: false,
      });
    }

    return [...prevMonthDays, ...currentDays, ...nextMonthDays];
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg min-h-[34px]",
    md: "px-3 py-2.5 text-sm rounded-xl min-h-[42px]",
  }[size];

  const accentRing = {
    emerald: "focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30",
    violet: "focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30",
    indigo: "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30",
  }[accentColor];

  const accentSelectedBg = {
    emerald: "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30 hover:bg-emerald-500",
    violet: "bg-violet-600 text-white font-bold shadow-md shadow-violet-600/30 hover:bg-violet-500",
    indigo: "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 hover:bg-indigo-500",
  }[accentColor];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input untuk form submit support jika ada form handler native */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 border bg-slate-950 text-left transition select-none ${sizeClasses} ${
          isOpen
            ? "border-emerald-500 ring-1 ring-emerald-500/30"
            : "border-slate-800 hover:border-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-900" : "cursor-pointer"} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className={`truncate ${value ? "text-slate-100 font-medium" : "text-slate-500"}`}>
            {value ? formatToIdDisplay(value) : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 hover:text-slate-200 hover:bg-slate-800 rounded transition"
              title="Hapus tanggal"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </button>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1.5 z-50 w-72 sm:w-80 rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-3.5 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Quick Presets */}
          {quickPresets && (
            <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-slate-800/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => selectDate(todayStr)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                  value === todayStr
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  selectDate(toIsoDate(yesterday));
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition shrink-0"
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstDay = new Date(viewYear, viewMonth, 1);
                  selectDate(toIsoDate(firstDay));
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition shrink-0"
              >
                Awal Bulan
              </button>
            </div>
          )}

          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
              <span>{MONTH_NAMES_ID[viewMonth]}</span>
              <span className="text-emerald-400 font-mono">{viewYear}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES_ID.map((d, i) => (
              <div
                key={d}
                className={`text-[10px] font-bold py-1 select-none ${
                  i === 0 || i === 6 ? "text-rose-400/80" : "text-slate-400"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((item, idx) => {
              const isSelected = item.dateStr === value;
              const isToday = item.dateStr === todayStr;
              const isDisabled =
                (minDate && item.dateStr < minDate) ||
                (maxDate && item.dateStr > maxDate);

              return (
                <button
                  key={`${item.dateStr}_${idx}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDate(item.dateStr)}
                  className={`h-8 w-full rounded-lg text-xs flex items-center justify-center transition select-none relative ${
                    isDisabled
                      ? "opacity-20 cursor-not-allowed text-slate-600"
                      : isSelected
                      ? accentSelectedBg
                      : !item.isCurrentMonth
                      ? "text-slate-600 hover:bg-slate-800/40 hover:text-slate-400"
                      : "text-slate-200 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span>{item.day}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Status */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1 text-[10px]">
              <Clock className="h-3 w-3 text-slate-500" />
              Hari ini: {todayStr}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-200 font-medium px-2 py-0.5 rounded hover:bg-slate-800 transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

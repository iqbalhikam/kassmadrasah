"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: "emerald" | "rose" | "violet" | "amber" | "blue" | "slate";
  description?: string;
  disabled?: boolean;
}

export interface ModernSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  size?: "sm" | "md";
  accentColor?: "emerald" | "violet" | "indigo";
  id?: string;
  name?: string;
  required?: boolean;
  allowClear?: boolean;
}

const badgeColorMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  slate: "bg-slate-800 text-slate-400 border-slate-700",
};

export function ModernSelect({
  options,
  value,
  onChange,
  placeholder = "-- Pilih --",
  searchable,
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  size = "md",
  accentColor = "emerald",
  id,
  name,
  required = false,
  allowClear = false,
}: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const internalId = useId();
  const selectId = id || internalId;

  const isSearchable = searchable ?? options.length > 6;

  // Temukan opsi yang sedang terpilih
  const selectedOption = options.find((opt) => opt.value === value);

  // Filter opsi berdasarkan search
  const filteredOptions = searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Tutup dropdown saat klik di luar
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

  // Focus search input saat dropdown terbuka
  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen, isSearchable]);

  // Handle keyboard navigation (Escape to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const accentBorderFocus = {
    emerald: "focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30",
    violet: "focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30",
    indigo: "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30",
  }[accentColor];

  const accentItemActive = {
    emerald: "bg-emerald-500/10 text-emerald-300 font-semibold",
    violet: "bg-violet-500/10 text-violet-300 font-semibold",
    indigo: "bg-indigo-500/10 text-indigo-300 font-semibold",
  }[accentColor];

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs rounded-lg min-h-[34px]",
    md: "px-3 py-2.5 text-sm rounded-xl min-h-[42px]",
  }[size];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input untuk form submit support jika dibutuhkan */}
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
        id={selectId}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 border bg-slate-950 text-left transition select-none ${sizeClasses} ${
          isOpen
            ? accentBorderFocus + " border-emerald-500"
            : "border-slate-800 hover:border-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-900" : "cursor-pointer"} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="shrink-0 text-slate-400">{selectedOption.icon}</span>
              )}
              <span className="truncate text-slate-100 font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={`ml-1 shrink-0 rounded-md border px-1.5 py-0.2 text-[10px] font-semibold ${
                    badgeColorMap[selectedOption.badgeColor || "slate"]
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="truncate text-slate-500">{placeholder}</span>
          )}
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
              title="Hapus pilihan"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-slate-200" : "text-slate-400"
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 mt-1.5 z-50 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
          style={{ maxHeight: "280px" }}
        >
          {/* Search Box jika list banyak atau searchable=true */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari pilihan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-slate-400 hover:text-slate-200 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="p-1 max-h-[220px] overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                Tidak ada pilihan yang cocok
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition select-none ${
                      opt.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : isSelected
                        ? accentItemActive
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate font-medium">{opt.label}</span>
                          {opt.badge && (
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[9px] font-semibold ${
                                badgeColorMap[opt.badgeColor || "slate"]
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

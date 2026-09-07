/**
 * useCurrencyInput
 * Custom hook for currency-formatted inputs (Indonesian Rupiah).
 *
 * - Display: "Rp 1.500.000"
 * - Raw value (for form submission): "1500000"
 */

import { useState, useCallback } from "react";

function formatIDR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return "Rp " + parseInt(digits, 10).toLocaleString("id-ID");
}

function parseIDR(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

interface UseCurrencyInputOptions {
  initial?: string | number;
}

interface UseCurrencyInputReturn {
  /** Raw numeric string (e.g. "1500000"). Use this for form submission. */
  rawValue: string;
  /** Formatted display string (e.g. "Rp 1.500.000"). Bind to input value. */
  displayValue: string;
  /** Pass to input onChange handler */
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Programmatically set from a raw numeric value (number or string) */
  setFromRaw: (raw: string | number) => void;
  /** Reset to empty */
  reset: () => void;
}

export function useCurrencyInput(options: UseCurrencyInputOptions = {}): UseCurrencyInputReturn {
  const toRaw = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === "" || val === 0) return "";
    return String(val).replace(/\D/g, "");
  };

  const [rawValue, setRawValue] = useState<string>(toRaw(options.initial));

  const displayValue = formatIDR(rawValue);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = parseIDR(e.target.value);
    setRawValue(digits);
  }, []);

  const setFromRaw = useCallback((val: string | number) => {
    setRawValue(toRaw(val));
  }, []);

  const reset = useCallback(() => {
    setRawValue("");
  }, []);

  return { rawValue, displayValue, handleChange, setFromRaw, reset };
}

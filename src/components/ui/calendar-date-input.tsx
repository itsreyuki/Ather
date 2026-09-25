"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

type CalendarMode = "gregorian" | "hijri";

const hijriFormatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function partsFor(date: Date) {
  const parts = hijriFormatter.formatToParts(date);
  return {
    day: Number(parts.find((part) => part.type === "day")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    year: Number(parts.find((part) => part.type === "year")?.value),
  };
}

function hijriKey(parts: { year: number; month: number; day: number }) {
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function gregorianToHijri(value: string, dateOnly: boolean) {
  if (!value) return "";
  const date = new Date(`${value}${dateOnly ? "T00:00" : ""}Z`);
  if (Number.isNaN(date.valueOf())) return "";
  const parts = partsFor(date);
  if (dateOnly) return `${parts.year}/${pad(parts.month)}/${pad(parts.day)}`;
  return `${parts.year}/${pad(parts.month)}/${pad(parts.day)} ${value.slice(11, 16)}`;
}

function hijriToGregorian(value: string, fallbackTime: string, dateOnly: boolean) {
  const normalized = normalizeDigits(value.trim()).replace(/\s+/g, " ");
  const match = normalized.match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const fallbackHour = fallbackTime.slice(0, 2) || "0";
  const fallbackMinute = fallbackTime.slice(3, 5) || "0";
  const hour = dateOnly ? 0 : Number(match[4] ?? fallbackHour);
  const minute = dateOnly ? 0 : Number(match[5] ?? fallbackMinute);
  if (month < 1 || month > 12 || day < 1 || day > 30 || hour > 23 || minute > 59) return null;

  const target = hijriKey({ year, month, day });
  let low = Date.UTC(year + 621, 0, 1);
  let high = Date.UTC(year + 624, 11, 31);
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2 / 86_400_000) * 86_400_000;
    const current = hijriKey(partsFor(new Date(middle)));
    if (current === target) {
      const result = new Date(middle);
      const isoDate = `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
      return dateOnly ? isoDate : `${isoDate}T${pad(hour)}:${pad(minute)}`;
    }
    if (current < target) low = middle + 86_400_000;
    else high = middle - 86_400_000;
  }
  return null;
}

export function CalendarDateInput({
  label,
  value,
  defaultValue = "",
  onChange,
  required = false,
  dateOnly = false,
  name,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  dateOnly?: boolean;
  name?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [mode, setMode] = useState<CalendarMode>("gregorian");
  const [hijriText, setHijriText] = useState(() => gregorianToHijri(value ?? defaultValue, dateOnly));
  const [error, setError] = useState("");
  const currentValue = value ?? internalValue;

  function commit(next: string) {
    setInternalValue(next);
    onChange?.(next);
  }

  function changeMode(nextMode: CalendarMode) {
    setError("");
    setMode(nextMode);
    if (nextMode === "hijri") setHijriText(gregorianToHijri(currentValue, dateOnly));
  }

  function onHijriChange(nextText: string) {
    setHijriText(nextText);
    const converted = hijriToGregorian(nextText, currentValue.slice(11, 16) || "00:00", dateOnly);
    if (converted) {
      setError("");
      commit(converted);
    } else if (nextText.trim()) {
      commit("");
      setError(dateOnly ? "اكتب التاريخ الهجري بصيغة 1447/01/15" : "اكتب التاريخ والوقت الهجريين بصيغة 1447/01/15 14:30");
    } else {
      setError("");
      commit("");
    }
  }

  return (
    <label className="field calendar-date-field">
      <span>
        {label}
        {required && <em>مطلوب</em>}
      </span>
      <div className="calendar-date-control">
        <div className="calendar-mode-switch" role="group" aria-label={`تقويم ${label}`}>
          <button type="button" className={mode === "gregorian" ? "active" : ""} onClick={() => changeMode("gregorian")}>
            <CalendarDays size={13} aria-hidden="true" /> ميلادي
          </button>
          <button type="button" className={mode === "hijri" ? "active" : ""} onClick={() => changeMode("hijri")}>
            هجري
          </button>
        </div>
        {mode === "gregorian" ? (
          <input
            value={currentValue}
            onChange={(event) => commit(event.target.value)}
            type={dateOnly ? "date" : "datetime-local"}
            required={required}
            aria-label={`${label} ميلادي`}
          />
        ) : (
          <input
            value={hijriText}
            onChange={(event) => onHijriChange(event.target.value)}
            type="text"
            inputMode="numeric"
            placeholder={dateOnly ? "1447/01/15" : "1447/01/15 14:30"}
            required={required}
            aria-label={`${label} هجري`}
            dir="ltr"
          />
        )}
        {name && <input type="hidden" name={name} value={currentValue} />}
      </div>
      {mode === "hijri" && <small className="calendar-date-hint">التقويم الهجري أم القرى · يُحفظ الموعد قياسيًا لضمان دقة التنبيهات.</small>}
      {error && <small className="calendar-date-error" role="alert">{error}</small>}
    </label>
  );
}

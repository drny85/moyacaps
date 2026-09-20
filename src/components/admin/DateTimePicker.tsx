"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, Sparkles } from "lucide-react";

interface DateTimePickerProps {
  value: number; // timestamp in ms
  onChange: (newTimestamp: number) => void;
  minDate?: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const PRESET_AM_TIMES = [
  { value: "06:00", label: "6:00 AM (Early Access)", hours: 6, minutes: 0 },
  { value: "06:30", label: "6:30 AM", hours: 6, minutes: 30 },
  { value: "07:00", label: "7:00 AM", hours: 7, minutes: 0 },
  { value: "07:30", label: "7:30 AM", hours: 7, minutes: 30 },
  { value: "08:00", label: "8:00 AM (Standard)", hours: 8, minutes: 0 },
  { value: "08:30", label: "8:30 AM", hours: 8, minutes: 30 },
  { value: "09:00", label: "9:00 AM (Recommended)", hours: 9, minutes: 0 },
  { value: "09:30", label: "9:30 AM", hours: 9, minutes: 30 },
  { value: "10:00", label: "10:00 AM", hours: 10, minutes: 0 },
  { value: "10:30", label: "10:30 AM", hours: 10, minutes: 30 },
  { value: "11:00", label: "11:00 AM", hours: 11, minutes: 0 },
  { value: "11:30", label: "11:30 AM", hours: 11, minutes: 30 },
];

export function DateTimePicker({ value, onChange, minDate = Date.now() }: DateTimePickerProps) {
  const currentDate = useMemo(() => new Date(value || Date.now() + 86400000 * 3), [value]);

  // Calendar View month/year state
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
  const [showCustomTime, setShowCustomTime] = useState(false);

  // Time components
  const hours24 = currentDate.getHours();
  const minutes = currentDate.getMinutes();
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  const matchingPreset = PRESET_AM_TIMES.find(
    (p) => p.hours === hours24 && p.minutes === minutes
  );
  const selectedDropdownValue = matchingPreset ? matchingPreset.value : "custom";

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Calendar grid calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  // Helper to construct updated timestamp
  const updateTimestamp = (newDate: Date) => {
    onChange(newDate.getTime());
  };

  const handleSelectDay = (day: number) => {
    const next = new Date(currentDate);
    next.setFullYear(viewYear);
    next.setMonth(viewMonth);
    next.setDate(day);
    updateTimestamp(next);
  };

  const handleHourChange = (newHour12: number) => {
    const clampedHour12 = Math.max(1, Math.min(12, newHour12));
    let newHour24 = clampedHour12;
    if (ampm === "PM" && clampedHour12 < 12) newHour24 += 12;
    if (ampm === "AM" && clampedHour12 === 12) newHour24 = 0;

    const next = new Date(currentDate);
    next.setHours(newHour24);
    updateTimestamp(next);
  };

  const handleMinuteChange = (newMinutes: number) => {
    const clampedMinutes = Math.max(0, Math.min(59, newMinutes));
    const next = new Date(currentDate);
    next.setMinutes(clampedMinutes);
    updateTimestamp(next);
  };

  const toggleAmpm = () => {
    const next = new Date(currentDate);
    if (ampm === "AM") {
      next.setHours(hours24 + 12);
    } else {
      next.setHours(hours24 - 12);
    }
    updateTimestamp(next);
  };

  // Quick Preset Actions
  const applyPreset = (preset: "24h" | "3d" | "7d" | "fri6am") => {
    const now = new Date();
    if (preset === "24h") {
      const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      next.setHours(6, 0, 0, 0);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
      updateTimestamp(next);
    } else if (preset === "3d") {
      const next = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      next.setHours(6, 0, 0, 0);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
      updateTimestamp(next);
    } else if (preset === "7d") {
      const next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      next.setHours(6, 0, 0, 0);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
      updateTimestamp(next);
    } else if (preset === "fri6am") {
      const next = new Date(now);
      const day = now.getDay();
      const daysUntilFriday = (5 - day + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntilFriday);
      next.setHours(6, 0, 0, 0);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
      updateTimestamp(next);
    }
  };

  const handleSelectTimePreset = (val: string) => {
    if (val === "custom") {
      setShowCustomTime(true);
      return;
    }
    const preset = PRESET_AM_TIMES.find((p) => p.value === val);
    if (!preset) return;
    const next = new Date(currentDate);
    next.setHours(preset.hours, preset.minutes, 0, 0);
    updateTimestamp(next);
  };

  // Relative countdown summary
  const diffMs = value - Date.now();
  const isPast = diffMs <= 0;
  const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hoursDiff = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Quick Presets Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-black/5 dark:border-white/5 w-full min-w-0">
        <button
          type="button"
          onClick={() => applyPreset("24h")}
          className="py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:text-moya-red transition-all text-center truncate shadow-2xs"
        >
          +24h (6 AM)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("3d")}
          className="py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:text-moya-red transition-all text-center truncate shadow-2xs"
        >
          +3d (6 AM)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("7d")}
          className="py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:text-moya-red transition-all text-center truncate shadow-2xs"
        >
          +1w (6 AM)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("fri6am")}
          className="py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold bg-moya-red/10 text-moya-red hover:bg-moya-red hover:text-white transition-all text-center truncate shadow-2xs"
        >
          Fri 6:00 AM
        </button>
      </div>

      {/* Calendar Grid Container */}
      <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 shadow-xs">
        {/* Month & Year Navigation */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-moya-red" />
            <span className="font-display font-bold text-sm text-zinc-900 dark:text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAYS.map((wd) => (
            <span key={wd} className="text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-400 py-1">
              {wd}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Empty spacer cells before 1st of the month */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
          ))}

          {/* Days of Month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayDate = new Date(viewYear, viewMonth, dayNum, 23, 59, 59);
            const isDayPast = dayDate.getTime() < minDate;
            const isSelected =
              currentDate.getFullYear() === viewYear &&
              currentDate.getMonth() === viewMonth &&
              currentDate.getDate() === dayNum;

            const isToday =
              new Date().getFullYear() === viewYear &&
              new Date().getMonth() === viewMonth &&
              new Date().getDate() === dayNum;

            return (
              <button
                key={dayNum}
                type="button"
                disabled={isDayPast}
                onClick={() => handleSelectDay(dayNum)}
                className={`h-8 rounded-xl text-xs font-mono font-medium transition-all flex items-center justify-center relative ${
                  isSelected
                    ? "bg-moya-red text-white font-bold shadow-md shadow-moya-red/30 scale-105 z-10"
                    : isDayPast
                    ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-40"
                    : isToday
                    ? "text-moya-red font-bold hover:bg-moya-red/10 border border-moya-red/30"
                    : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.08]"
                }`}
              >
                <span>{dayNum}</span>
                {isToday && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-moya-red absolute bottom-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Release Time Section: Dropdown with AM Hours + Optional Custom Controls */}
      <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 space-y-3 w-full min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-moya-red/10 text-moya-red flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-display font-semibold text-zinc-900 dark:text-white block truncate">
                Release Time (AM Hours)
              </span>
              <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 block truncate">
                Starts at 6:00 AM
              </span>
            </div>
          </div>

          {/* AM Hours Dropdown & Optional Custom Toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <select
              value={selectedDropdownValue}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setShowCustomTime(true);
                } else {
                  handleSelectTimePreset(e.target.value);
                }
              }}
              className="flex-1 sm:flex-none min-w-0 max-w-full sm:max-w-[210px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono font-bold text-zinc-900 dark:text-white shadow-2xs focus:outline-none focus:border-moya-red truncate cursor-pointer"
            >
              <optgroup label="Select AM Drop Hour">
                {PRESET_AM_TIMES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <option value="custom">Custom Time (Optional)...</option>
            </select>

            <button
              type="button"
              onClick={() => setShowCustomTime((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-semibold transition-all border shrink-0 ${
                showCustomTime
                  ? "bg-moya-red/10 border-moya-red/30 text-moya-red"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
              title="Toggle Custom Manual Time Inputs"
            >
              {showCustomTime ? "Hide" : "Custom"}
            </button>
          </div>
        </div>

        {/* Optional Manual Time Inputs */}
        {showCustomTime && (
          <div className="pt-3 border-t border-zinc-200/70 dark:border-white/[0.06] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 animate-in fade-in duration-150 w-full min-w-0">
            <span className="text-[10px] font-mono text-zinc-500 shrink-0">
              Manual Hour / Minute:
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Hours (1-12) */}
              <div className="flex items-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 px-2 py-1 shadow-2xs">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={hours12}
                  onChange={(e) => handleHourChange(parseInt(e.target.value) || 12)}
                  className="w-8 text-center text-sm font-mono font-bold text-zinc-900 dark:text-white bg-transparent outline-hidden"
                />
                <span className="text-zinc-400 font-mono font-bold">:</span>
                {/* Minutes (0-59) */}
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={String(minutes).padStart(2, "0")}
                  onChange={(e) => handleMinuteChange(parseInt(e.target.value) || 0)}
                  className="w-9 text-center text-sm font-mono font-bold text-zinc-900 dark:text-white bg-transparent outline-hidden"
                />
              </div>

              {/* AM / PM Selector */}
              <button
                type="button"
                onClick={toggleAmpm}
                className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs hover:opacity-90 transition-opacity"
              >
                {ampm}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Target Preview Banner */}
      <div className={`p-3 rounded-xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs font-mono w-full min-w-0 overflow-hidden ${
        isPast
          ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {isPast ? "Target time is in the past" : `Releases in ${daysDiff}d ${hoursDiff}h`}
          </span>
        </div>
        <span className="font-bold shrink-0">
          {currentDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

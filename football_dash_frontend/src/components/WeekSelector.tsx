// football_dash_frontend/src/components/WeekSelector.tsx

import { useRef, useEffect } from "react";
import type { Week } from "../api";

type Props = {
  weeks: Week[];
  selectedWeek: number;
  onWeekChange: (week: number) => void;
};

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth.toUpperCase()} ${startDay} - ${endDay}`;
  }
  return `${startMonth.toUpperCase()} ${startDay} - ${endMonth.toUpperCase()} ${endDay}`;
}

export default function WeekSelector({
  weeks,
  selectedWeek,
  onWeekChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected week into view on mount
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const selected = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();

      // Center the selected week in the container
      const scrollLeft =
        selected.offsetLeft -
        container.offsetWidth / 2 +
        selected.offsetWidth / 2;

      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [selectedWeek]);

  const handlePrev = () => {
    const currentIndex = weeks.findIndex((w) => w.number === selectedWeek);
    if (currentIndex > 0) {
      onWeekChange(weeks[currentIndex - 1].number);
    }
  };

  const handleNext = () => {
    const currentIndex = weeks.findIndex((w) => w.number === selectedWeek);
    if (currentIndex < weeks.length - 1) {
      onWeekChange(weeks[currentIndex + 1].number);
    }
  };

  const currentIndex = weeks.findIndex((w) => w.number === selectedWeek);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < weeks.length - 1;

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Left arrow */}
      <button
        onClick={handlePrev}
        disabled={!canGoPrev}
        className={`p-2 rounded-full transition ${
          canGoPrev
            ? "text-slate-300 hover:bg-slate-700"
            : "text-slate-600 cursor-not-allowed"
        }`}
        aria-label="Previous week"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Scrollable week tabs */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex gap-1 px-1">
          {weeks.map((week) => {
            const isSelected = week.number === selectedWeek;
            const dateRange = formatDateRange(week.startDate, week.endDate);

            return (
              <button
                key={week.number}
                ref={isSelected ? selectedRef : null}
                onClick={() => onWeekChange(week.number)}
                className={`flex flex-col items-center px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  isSelected
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    isSelected ? "text-white" : ""
                  }`}
                >
                  {week.label.toUpperCase()}
                </span>
                {dateRange && (
                  <span
                    className={`text-[10px] mt-0.5 ${
                      isSelected ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {dateRange}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right arrow */}
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className={`p-2 rounded-full transition ${
          canGoNext
            ? "text-slate-300 hover:bg-slate-700"
            : "text-slate-600 cursor-not-allowed"
        }`}
        aria-label="Next week"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}

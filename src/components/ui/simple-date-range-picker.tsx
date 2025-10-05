import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, isToday } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DateRange {
  from?: Date;
  to?: Date;
}

interface SimpleDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  locale?: typeof ro;
  numberOfMonths?: number;
}

export function SimpleDateRangePicker({ 
  value, 
  onChange, 
  disabled,
  className,
  locale = ro,
  numberOfMonths = 2
}: SimpleDateRangePickerProps) {
  const [displayMonth, setDisplayMonth] = React.useState(value?.from || new Date());

  const handlePrevMonth = () => setDisplayMonth(subMonths(displayMonth, 1));
  const handleNextMonth = () => setDisplayMonth(addMonths(displayMonth, 1));

  const handleDateClick = (date: Date) => {
    if (disabled && disabled(date)) return;

    if (!value?.from || (value.from && value.to)) {
      // Start new selection
      onChange?.({ from: date, to: undefined });
    } else if (value.from && !value.to) {
      // Complete selection
      if (date < value.from) {
        onChange?.({ from: date, to: value.from });
      } else {
        onChange?.({ from: value.from, to: date });
      }
    }
  };

  const renderMonth = (monthOffset: number) => {
    const currentMonth = addMonths(displayMonth, monthOffset);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { locale, weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { locale, weekStartsOn: 1 });

    const days: Date[] = [];
    let currentDate = startDate;
    while (currentDate <= endDate) {
      days.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(startOfWeek(new Date(), { locale, weekStartsOn: 1 }), i);
      return format(day, 'EEEEEE', { locale });
    });

    return (
      <div key={monthOffset} className="w-fit">
        {/* Month header */}
        <div className="text-sm font-semibold capitalize text-center mb-3">
          {format(currentMonth, 'MMMM yyyy', { locale })}
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="h-9 w-9 flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isDisabled = disabled && disabled(day);
            const isTodayDate = isToday(day);
            
            const isStart = value?.from && isSameDay(day, value.from);
            const isEnd = value?.to && isSameDay(day, value.to);
            const isInRange = value?.from && value?.to && 
              isWithinInterval(day, { start: value.from, end: value.to });

            return (
              <button
                key={i}
                onClick={() => handleDateClick(day)}
                disabled={isDisabled}
                className={cn(
                  "h-9 w-9 rounded-md text-sm font-normal transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !isCurrentMonth && "text-muted-foreground/40",
                  (isStart || isEnd) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-semibold",
                  isInRange && !isStart && !isEnd && "bg-accent text-accent-foreground",
                  isTodayDate && !isStart && !isEnd && "ring-1 ring-primary/40",
                  isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("w-fit select-none", className)}>
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Months */}
      <div className="flex gap-4">
        {Array.from({ length: numberOfMonths }, (_, i) => renderMonth(i))}
      </div>
    </div>
  );
}

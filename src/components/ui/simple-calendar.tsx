import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SimpleCalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  locale?: typeof ro;
}

export function SimpleCalendar({ 
  value, 
  onChange, 
  disabled,
  className,
  locale = ro
}: SimpleCalendarProps) {
  const [displayMonth, setDisplayMonth] = React.useState(value || new Date());

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const startDate = startOfWeek(monthStart, { locale, weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { locale, weekStartsOn: 1 });

  const days: Date[] = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    days.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  const handlePrevMonth = () => setDisplayMonth(subMonths(displayMonth, 1));
  const handleNextMonth = () => setDisplayMonth(addMonths(displayMonth, 1));

  const handleDateClick = (date: Date) => {
    if (disabled && disabled(date)) return;
    onChange?.(date);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(startOfWeek(new Date(), { locale, weekStartsOn: 1 }), i);
    return format(day, 'EEEEEE', { locale });
  });

  return (
    <div className={cn("w-fit select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-sm font-semibold capitalize">
          {format(displayMonth, 'MMMM yyyy', { locale })}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
          const isSelected = value && isSameDay(day, value);
          const isCurrentMonth = isSameMonth(day, displayMonth);
          const isDisabled = disabled && disabled(day);
          const isTodayDate = isToday(day);

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
                isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                isTodayDate && !isSelected && "bg-accent/30 font-semibold ring-1 ring-primary/40",
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
}

// Add React import
import * as React from "react";

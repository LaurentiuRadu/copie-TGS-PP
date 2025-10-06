import * as React from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, format, isSameMonth, isSameDay, getWeek } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface SimpleCalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  month?: Date;
  disabled?: (date: Date) => boolean;
  className?: string;
}

export function SimpleCalendar({ 
  selected, 
  onSelect, 
  month = new Date(), 
  disabled,
  className 
}: SimpleCalendarProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  // Group days by week
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  days.forEach((day, index) => {
    currentWeek.push(day);
    if ((index + 1) % 7 === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  
  return (
    <div className={cn("p-3", className)}>
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="text-sm font-medium text-foreground">
            {format(month, "MMMM yyyy", { locale: ro })}
          </div>
        </div>
        
        {/* Header with week number column */}
        <div className="grid grid-cols-8 gap-1">
          <div className="h-9 w-9 flex items-center justify-center text-[0.8rem] font-normal text-muted-foreground">
            S
          </div>
          {["L", "M", "M", "J", "V", "S", "D"].map((day, i) => (
            <div 
              key={i} 
              className="h-9 w-9 flex items-center justify-center text-[0.8rem] font-normal text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid with week numbers */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-8 gap-1">
              {/* Week number */}
              <div className="h-9 w-9 flex items-center justify-center text-sm font-medium text-muted-foreground border-r border-border">
                {getWeek(week[0], { weekStartsOn: 1, locale: ro })}
              </div>
              
              {/* Days */}
              {week.map((day, dayIndex) => {
                const isSelected = selected && isSameDay(day, selected);
                const isCurrentMonth = isSameMonth(day, month);
                const isDisabled = disabled?.(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <button
                    key={dayIndex}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onSelect?.(day)}
                    className={cn(
                      "h-9 w-9 p-0 font-normal rounded-md text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50",
                      !isCurrentMonth && "text-muted-foreground opacity-50",
                      isToday && "bg-accent text-accent-foreground",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
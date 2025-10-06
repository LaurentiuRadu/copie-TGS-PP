import * as React from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, format, isSameMonth, isSameDay, getWeek } from "date-fns";
import { ro } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface SimpleCalendarProps {
  selected?: Date;
  selectedRange?: DateRange;
  onSelect?: (date: Date) => void;
  onRangeSelect?: (range: DateRange) => void;
  month?: Date;
  disabled?: (date: Date) => boolean;
  className?: string;
  mode?: 'single' | 'range';
}

export function SimpleCalendar({ 
  selected,
  selectedRange,
  onSelect,
  onRangeSelect,
  month = new Date(), 
  disabled,
  className,
  mode = 'single'
}: SimpleCalendarProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<Date | null>(null);
  const [dragEnd, setDragEnd] = React.useState<Date | null>(null);
  
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
  
  const handleMouseDown = (date: Date) => {
    if (mode === 'range' && !disabled?.(date)) {
      setIsDragging(true);
      setDragStart(date);
      setDragEnd(date);
    }
  };
  
  const handleMouseEnter = (date: Date) => {
    if (isDragging && mode === 'range' && !disabled?.(date)) {
      setDragEnd(date);
    }
  };
  
  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      const from = dragStart < dragEnd ? dragStart : dragEnd;
      const to = dragStart < dragEnd ? dragEnd : dragStart;
      onRangeSelect?.({ from, to });
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  };
  
  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };
  
  const handleClick = (date: Date) => {
    if (mode === 'single') {
      onSelect?.(date);
    } else if (!isDragging) {
      // Fallback click for range mode (accessibility)
      onSelect?.(date);
    }
  };
  
  const isInDragRange = (date: Date): boolean => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;
    return date >= start && date <= end;
  };
  
  const isInSelectedRange = (date: Date): boolean => {
    if (!selectedRange?.from) return false;
    if (!selectedRange.to) return isSameDay(date, selectedRange.from);
    return date >= selectedRange.from && date <= selectedRange.to;
  };
  
  const isRangeStart = (date: Date): boolean => {
    if (isDragging && dragStart && dragEnd) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      return isSameDay(date, start);
    }
    return selectedRange?.from ? isSameDay(date, selectedRange.from) : false;
  };
  
  const isRangeEnd = (date: Date): boolean => {
    if (isDragging && dragStart && dragEnd) {
      const end = dragStart < dragEnd ? dragEnd : dragStart;
      return isSameDay(date, end);
    }
    return selectedRange?.to ? isSameDay(date, selectedRange.to) : false;
  };
  
  return (
    <div 
      className={cn("p-3 select-none", className)}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
    >
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
                const inRange = mode === 'range' && (isInDragRange(day) || isInSelectedRange(day));
                const rangeStart = mode === 'range' && isRangeStart(day);
                const rangeEnd = mode === 'range' && isRangeEnd(day);
                const rangeMiddle = inRange && !rangeStart && !rangeEnd;
                
                return (
                  <button
                    key={dayIndex}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleClick(day)}
                    onMouseDown={() => handleMouseDown(day)}
                    onMouseEnter={() => handleMouseEnter(day)}
                    className={cn(
                      "h-9 w-9 p-0 font-normal text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50",
                      !isCurrentMonth && "text-muted-foreground opacity-50",
                      isToday && !inRange && "bg-accent text-accent-foreground",
                      isSelected && mode === 'single' && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      mode === 'range' && isDragging && "cursor-crosshair",
                      mode === 'range' && !isDragging && "cursor-pointer",
                      rangeStart && "rounded-l-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      rangeEnd && "rounded-r-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      rangeMiddle && "rounded-none bg-primary/20 text-foreground",
                      rangeStart && rangeEnd && "rounded-md"
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
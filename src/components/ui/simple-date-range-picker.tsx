import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { SimpleCalendar, DateRange } from "./simple-calendar";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface SimpleDateRangePickerProps {
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
}

export function SimpleDateRangePicker({ 
  selected, 
  onSelect, 
  disabled,
  className 
}: SimpleDateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  
  const handleRangeSelect = (range: DateRange) => {
    onSelect?.(range);
  };
  
  const handleDateClick = (date: Date) => {
    // Fallback single click for accessibility
    if (!selected?.from || selected?.to) {
      onSelect?.({ from: date, to: undefined });
    } else {
      if (date < selected.from) {
        onSelect?.({ from: date, to: selected.from });
      } else {
        onSelect?.({ ...selected, to: date });
      }
    }
  };
  
  return (
    <div className={cn("space-y-4 pointer-events-auto", className)}>
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Calendar */}
      <SimpleCalendar
        mode="range"
        selectedRange={selected}
        onRangeSelect={handleRangeSelect}
        onSelect={handleDateClick}
        month={currentMonth}
        disabled={disabled}
      />
      
      {/* Selection hint */}
      {selected?.from && !selected?.to && (
        <div className="text-xs text-center text-muted-foreground">
          Selectează data de sfârșit
        </div>
      )}
    </div>
  );
}
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { SimpleCalendar } from "./simple-calendar";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: Date;
  to?: Date;
}

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
  const [selectingRange, setSelectingRange] = React.useState<"from" | "to">("from");
  
  const handleDateSelect = (date: Date) => {
    if (selectingRange === "from") {
      onSelect?.({ from: date, to: undefined });
      setSelectingRange("to");
    } else {
      if (selected?.from && date < selected.from) {
        // If end date is before start date, swap them
        onSelect?.({ from: date, to: selected.from });
      } else {
        onSelect?.({ ...selected, to: date });
      }
      setSelectingRange("from");
    }
  };
  
  const isDateSelected = (date: Date): boolean => {
    if (!selected?.from) return false;
    
    if (!selected.to) {
      return date.getTime() === selected.from.getTime();
    }
    
    return date >= selected.from && date <= selected.to;
  };
  
  const getSelectedDate = (): Date | undefined => {
    if (!selected?.from) return undefined;
    
    // For visual feedback, show the date being selected
    if (selectingRange === "to") {
      return selected.from;
    }
    
    return selected.to || selected.from;
  };
  
  return (
    <div className={cn("space-y-4", className)}>
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
        selected={getSelectedDate()}
        onSelect={handleDateSelect}
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
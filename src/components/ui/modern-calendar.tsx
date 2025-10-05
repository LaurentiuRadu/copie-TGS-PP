import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { getWeek } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type ModernCalendarProps = React.ComponentProps<typeof DayPicker>;

function ModernCalendar({ 
  className, 
  classNames, 
  showOutsideDays = true, 
  ...props 
}: ModernCalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      showWeekNumber
      formatters={{
        formatWeekNumber: (weekNumber: number) => `S${weekNumber}`,
      }}
      className={cn("p-4 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-base font-semibold",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 transition-opacity"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex mt-2",
        head_cell: "text-muted-foreground rounded-md w-10 font-medium text-[0.85rem]",
        row: "flex w-full mt-1",
        cell: cn(
          "relative p-0 text-center text-sm",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent/50",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal transition-all duration-200",
          "hover:bg-accent hover:scale-110 hover:shadow-sm",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground",
          "hover:bg-primary hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
          "rounded-md shadow-md"
        ),
        day_today: cn(
          "bg-accent/30 font-semibold",
          "ring-2 ring-primary/40",
          "rounded-md",
          "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:ring-0"
        ),
        day_outside: cn(
          "day-outside text-muted-foreground/40 opacity-40",
          "aria-selected:bg-accent/30 aria-selected:text-muted-foreground aria-selected:opacity-30"
        ),
        day_disabled: "text-muted-foreground opacity-30",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        // Week number styling
        weeknumber: cn(
          "w-10 h-10 p-0 font-semibold text-xs",
          "flex items-center justify-center",
          "bg-muted/60 text-muted-foreground",
          "rounded-l-md border-r border-border/50"
        ),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => 
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
ModernCalendar.displayName = "ModernCalendar";

export { ModernCalendar };

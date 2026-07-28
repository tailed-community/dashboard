import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months:
          "flex flex-col relative sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-6 ",
        month_caption: "flex justify-center items-center",
        caption_label: "joy-display text-sm font-bold",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-9 top-3 h-8 w-8 rounded-lg bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-9 top-3 h-8 w-8 rounded-lg bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-9 text-[11px] font-bold uppercase tracking-wide",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center rounded-lg text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-lg p-0 font-semibold aria-selected:opacity-100"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground rounded-lg hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground [&_button]:text-primary-foreground [&_button:hover]:bg-transparent",
        today: "bg-joy-sun/25 text-joy-sun-ink font-bold rounded-lg",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => <Chevron {...props} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

function Chevron({ orientation = "left" }: { orientation?: string }) {
  switch (orientation) {
    case "left":
      return <ChevronLeftIcon className="h-4 w-4" />;
    case "right":
      return <ChevronRightIcon className="h-4 w-4" />;
    case "up":
      return <ChevronUpIcon className="h-4 w-4" />;
    case "down":
      return <ChevronDownIcon className="h-4 w-4" />;
    default:
      return null;
  }
}

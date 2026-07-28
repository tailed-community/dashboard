import * as React from "react";
import { DateTime } from "luxon";
import { CalendarClock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "./time-picker";

export type DateTimePickerProps = {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    onBlur?: () => void;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    /** Days strictly before this date are not selectable. */
    minDate?: Date;
    /** Days strictly after this date are not selectable. */
    maxDate?: Date;
    /** Time of day used when the user picks a first date. Defaults to 09:00. */
    defaultHour?: number;
    /** Amount an arrow key press moves the minute segment. Defaults to 1. */
    minuteStep?: number;
    /** Shows a clear button once a value is set. For optional fields. */
    clearable?: boolean;
    className?: string;
};

/**
 * Day and time in a single field: a calendar with the typed time segments
 * docked underneath.
 */
export function DateTimePicker({
    date,
    setDate,
    onBlur,
    name,
    placeholder = "Pick a date and time",
    disabled,
    minDate,
    maxDate,
    defaultHour = 9,
    minuteStep = 5,
    clearable = false,
    className,
}: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false);

    const isOutOfRange = React.useCallback(
        (candidate: Date) => {
            const day = DateTime.fromJSDate(candidate).startOf("day");
            if (minDate && day < DateTime.fromJSDate(minDate).startOf("day")) return true;
            if (maxDate && day > DateTime.fromJSDate(maxDate).startOf("day")) return true;
            return false;
        },
        [minDate, maxDate]
    );

    /**
     * Keep the time of day when the user clicks a different day. Rebuilding
     * from calendar fields rather than adding a day offset keeps this correct
     * across DST boundaries, where a day is not always 24 hours.
     */
    const handleSelect = (day: Date | undefined) => {
        if (!day) return;
        const next = new Date(day);
        if (date) {
            next.setHours(date.getHours(), date.getMinutes(), 0, 0);
        } else {
            next.setHours(defaultHour, 0, 0, 0);
        }
        setDate(next);
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) onBlur?.();
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    name={name}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start px-3 font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                        {date
                            ? DateTime.fromJSDate(date).toFormat("EEE, MMM d, yyyy 'at' h:mm a")
                            : placeholder}
                    </span>
                    {clearable && date && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            aria-label="Clear date and time"
                            className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDate(undefined);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDate(undefined);
                                }
                            }}
                        >
                            <X className="size-3.5" />
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    defaultMonth={date ?? minDate}
                    disabled={isOutOfRange}
                    autoFocus
                    onSelect={handleSelect}
                />
                <div className="flex items-center justify-center gap-2 border-t border-border p-3">
                    <TimePicker
                        date={date}
                        setDate={setDate}
                        minuteStep={minuteStep}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

import * as React from "react";
import { DateTime } from "luxon";
import { CalendarDays, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

/**
 * "yyyy-MM-dd" is the wire format the events API speaks. The pickers work in
 * `Date` now, so these two helpers are the conversion boundary the forms use
 * when reading from and writing to the API.
 */
const ISO_DATE = "yyyy-MM-dd";

export function parseISODate(value?: string): Date | undefined {
    if (!value) return undefined;
    const parsed = DateTime.fromFormat(value, ISO_DATE);
    return parsed.isValid ? parsed.toJSDate() : undefined;
}

export function formatISODate(date: Date): string {
    return DateTime.fromJSDate(date).toFormat(ISO_DATE);
}

export type DatePickerProps = {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    onBlur?: () => void;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    /** Dates strictly before this day are not selectable. */
    minDate?: Date;
    /** Dates strictly after this day are not selectable. */
    maxDate?: Date;
    /** Shows a clear button once a date is set. For optional fields. */
    clearable?: boolean;
    className?: string;
};

export function DatePicker({
    date,
    setDate,
    onBlur,
    name,
    placeholder = "Pick a date",
    disabled,
    minDate,
    maxDate,
    clearable = false,
    className,
}: DatePickerProps) {
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
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                        {date
                            ? DateTime.fromJSDate(date).toFormat("EEE, MMM d, yyyy")
                            : placeholder}
                    </span>
                    {clearable && date && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            aria-label="Clear date"
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
                    onSelect={(selected) => {
                        if (!selected) return;
                        setDate(selected);
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

import { cn } from "@/lib/utils";
import { DatePicker } from "./date-picker";
import { TimeField } from "./time-field";

export type DateTimeFieldProps = {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    onBlur?: () => void;
    name?: string;
    datePlaceholder?: string;
    disabled?: boolean;
    minDate?: Date;
    maxDate?: Date;
    /** Time of day applied when the user picks a day before setting a time. */
    defaultHour?: number;
    /** Amount an arrow key press moves the minute segment. Defaults to 5. */
    minuteStep?: number;
    /** Lets the whole value be cleared. For optional fields. */
    clearable?: boolean;
    className?: string;
};

/**
 * A day control and a time control over a single `Date`.
 *
 * Split rather than combined because the two halves are answered differently:
 * a day is chosen by looking at a calendar, a time is simply known and typed.
 * Putting the clock inside the calendar popover makes the easy half of the
 * question inherit the hard half's interaction cost.
 */
export function DateTimeField({
    date,
    setDate,
    onBlur,
    name,
    datePlaceholder = "Pick a date",
    disabled,
    minDate,
    maxDate,
    defaultHour = 9,
    minuteStep = 5,
    clearable = false,
    className,
}: DateTimeFieldProps) {
    /**
     * Rebuild from calendar fields rather than adding a day offset so the time
     * survives DST boundaries, where a day is not always 24 hours long.
     */
    const handleDayChange = (day: Date | undefined) => {
        if (!day) return setDate(undefined);
        const next = new Date(day);
        if (date) {
            next.setHours(date.getHours(), date.getMinutes(), 0, 0);
        } else {
            next.setHours(defaultHour, 0, 0, 0);
        }
        setDate(next);
    };

    return (
        <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
            <DatePicker
                date={date}
                setDate={handleDayChange}
                onBlur={onBlur}
                name={name}
                placeholder={datePlaceholder}
                disabled={disabled}
                minDate={minDate}
                maxDate={maxDate}
                clearable={clearable}
                className="sm:flex-1"
            />
            <TimeField
                date={date}
                setDate={setDate}
                onBlur={onBlur}
                disabled={disabled}
                minuteStep={minuteStep}
                className="sm:w-[168px] sm:shrink-0"
            />
        </div>
    );
}

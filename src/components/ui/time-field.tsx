import * as React from "react";
import { Clock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { TimePickerInput } from "./time-picker-input";
import { TimePeriodSelect } from "./period-select";
import type { Period } from "./time-picker-utils";
import { getPeriod } from "./time-picker-utils";

export type TimeFieldProps = {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    onBlur?: () => void;
    name?: string;
    disabled?: boolean;
    /** Amount an arrow key press moves the minute segment. Defaults to 5. */
    minuteStep?: number;
    /** Shows a clear button once a time is set. For optional fields. */
    clearable?: boolean;
    className?: string;
};

/**
 * Time entry as a flat field rather than a popover.
 *
 * Time has no equivalent of the calendar's month grid — there is nothing to
 * browse — so hiding two-digit segments behind a click is pure friction. The
 * segments sit inline and take focus directly, which also makes the field
 * behave like every other input in the form.
 */
export function TimeField({
    date,
    setDate,
    onBlur,
    name,
    disabled,
    minuteStep = 5,
    clearable = false,
    className,
}: TimeFieldProps) {
    const [fallbackPeriod, setFallbackPeriod] = React.useState<Period>("AM");
    const period = date ? getPeriod(date) : fallbackPeriod;

    const hourRef = React.useRef<HTMLInputElement>(null);
    const minuteRef = React.useRef<HTMLInputElement>(null);
    const periodRef = React.useRef<HTMLButtonElement>(null);

    // Strip the nested Inputs back to bare text so the wrapper below owns the
    // border, height and focus ring — otherwise every segment draws its own.
    const segmentClass =
        "h-7 w-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent";

    return (
        <div
            onBlur={(event) => {
                // Only a blur leaving the whole field counts; moving between
                // segments must not mark the form field touched.
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    onBlur?.();
                }
            }}
            className={cn(
                // Kept in lockstep with <Input> so the wrapper is indistinguishable
                // from a plain text field sitting next to it.
                "flex h-10 w-full items-center gap-1 rounded-xl border border-input bg-background px-3.5 transition-[color,box-shadow,border-color]",
                "hover:border-joy-ink/25 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/60",
                disabled && "pointer-events-none opacity-50",
                className
            )}
        >
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <TimePickerInput
                picker="12hours"
                period={period}
                date={date}
                setDate={setDate}
                disabled={disabled}
                name={name}
                ref={hourRef}
                className={segmentClass}
                onRightFocus={() => minuteRef.current?.focus()}
            />
            <span aria-hidden className="select-none text-muted-foreground">
                :
            </span>
            <TimePickerInput
                picker="minutes"
                date={date}
                setDate={setDate}
                disabled={disabled}
                step={minuteStep}
                ref={minuteRef}
                className={segmentClass}
                onLeftFocus={() => hourRef.current?.focus()}
                onRightFocus={() => periodRef.current?.focus()}
            />
            <TimePeriodSelect
                period={period}
                setPeriod={setFallbackPeriod}
                date={date}
                setDate={setDate}
                disabled={disabled}
                ref={periodRef}
                // `data-[size=...]:h-*` on SelectTrigger outranks a bare `h-7`,
                // so the AM/PM select has to override on the same attribute or
                // it stretches to the wrapper's full height.
                className="w-auto gap-1 border-0 bg-transparent px-1 shadow-none hover:border-transparent focus:ring-0 focus-visible:ring-0 data-[size=default]:h-7 data-[size=sm]:h-7"
                onLeftFocus={() => minuteRef.current?.focus()}
            />
            {clearable && date && !disabled && (
                <button
                    type="button"
                    aria-label="Clear time"
                    className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setDate(undefined)}
                >
                    <X className="size-3.5" />
                </button>
            )}
        </div>
    );
}

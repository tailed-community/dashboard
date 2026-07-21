import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { TimePickerInput } from "./time-picker-input";
import { TimePeriodSelect } from "./period-select";
import type { Period } from "./time-picker-utils";
import { getPeriod } from "./time-picker-utils";

export interface TimePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    disabled?: boolean;
    /** Amount an arrow key press moves the minute segment. Defaults to 1. */
    minuteStep?: number;
    /** Render "Hours"/"Minutes" captions above the segments. */
    showLabels?: boolean;
    className?: string;
}

/**
 * A 12-hour hour:minute picker built from typed segments.
 *
 * The AM/PM state is derived from the date itself rather than held separately,
 * so a date arriving from outside (a form reset, a loaded event) always shows
 * the right period instead of whatever the component last remembered.
 */
export function TimePicker({
    date,
    setDate,
    disabled,
    minuteStep = 1,
    showLabels = false,
    className,
}: TimePickerProps) {
    const [fallbackPeriod, setFallbackPeriod] = React.useState<Period>("AM");
    const period = date ? getPeriod(date) : fallbackPeriod;

    const hourRef = React.useRef<HTMLInputElement>(null);
    const minuteRef = React.useRef<HTMLInputElement>(null);
    const periodRef = React.useRef<HTMLButtonElement>(null);

    const segment = (label: string, control: React.ReactNode) =>
        showLabels ? (
            <div className="grid gap-1 text-center">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                {control}
            </div>
        ) : (
            control
        );

    return (
        <div className={cn("flex items-end gap-2", className)}>
            {segment(
                "Hours",
                <TimePickerInput
                    picker="12hours"
                    period={period}
                    date={date}
                    setDate={setDate}
                    disabled={disabled}
                    ref={hourRef}
                    onRightFocus={() => minuteRef.current?.focus()}
                />
            )}
            <span
                aria-hidden
                className={cn(
                    "text-muted-foreground select-none",
                    showLabels ? "pb-2" : "self-center"
                )}
            >
                :
            </span>
            {segment(
                "Minutes",
                <TimePickerInput
                    picker="minutes"
                    date={date}
                    setDate={setDate}
                    disabled={disabled}
                    step={minuteStep}
                    ref={minuteRef}
                    onLeftFocus={() => hourRef.current?.focus()}
                    onRightFocus={() => periodRef.current?.focus()}
                />
            )}
            {segment(
                "Period",
                <TimePeriodSelect
                    period={period}
                    setPeriod={setFallbackPeriod}
                    date={date}
                    setDate={setDate}
                    disabled={disabled}
                    ref={periodRef}
                    onLeftFocus={() => minuteRef.current?.focus()}
                />
            )}
        </div>
    );
}

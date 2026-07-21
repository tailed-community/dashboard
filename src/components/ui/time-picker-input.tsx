import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { Period, TimePickerType } from "./time-picker-utils";
import {
    getArrowByType,
    getDateByType,
    setDateByType,
} from "./time-picker-utils";

export interface TimePickerInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
    picker: TimePickerType;
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    period?: Period;
    /** Amount an arrow key press moves this segment. Defaults to 1. */
    step?: number;
    onRightFocus?: () => void;
    onLeftFocus?: () => void;
}

/**
 * A single two-digit time segment.
 *
 * Typing is the primary interaction: the first digit fills the tens place and
 * the second digit completes the segment and advances focus, so "0930" walks
 * hours -> minutes without touching the mouse. Arrow keys step the value and
 * wrap. The caret is hidden because the segment is always fully replaced —
 * a blinking cursor inside a value you cannot partially edit reads as broken.
 */
const TimePickerInput = React.forwardRef<HTMLInputElement, TimePickerInputProps>(
    (
        {
            className,
            type = "tel",
            id,
            name,
            date,
            setDate,
            onKeyDown,
            onFocus,
            picker,
            period,
            step = 1,
            onLeftFocus,
            onRightFocus,
            disabled,
            ...props
        },
        ref
    ) => {
        const [flag, setFlag] = React.useState(false);
        const [prevIntKey, setPrevIntKey] = React.useState("0");

        // A date is needed to render a value at all; when the field is still
        // empty we display midnight and only commit a real date once the user
        // actually types. Memoised so it stays stable across renders.
        const fallback = React.useMemo(() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d;
        }, []);
        const activeDate = date ?? fallback;

        /**
         * Give the user 2 seconds to enter the second digit, then start over
         * from the tens place.
         */
        React.useEffect(() => {
            if (!flag) return;
            const timer = setTimeout(() => setFlag(false), 2000);
            return () => clearTimeout(timer);
        }, [flag]);

        const calculatedValue = React.useMemo(
            () => getDateByType(activeDate, picker),
            [activeDate, picker]
        );

        // With no value set, show dashes rather than the midnight fallback —
        // rendering "12" in an empty field reads as a time the user chose.
        const displayValue = date ? calculatedValue : "--";

        const calculateNewValue = (key: string) => {
            /*
             * On a 12-hour clock "0" alone is invalid and clamps to 01, which would
             * make a subsequent digit read as 1X. Detect that clamp and treat the
             * next key as the ones place instead, so "0" then "9" yields 09.
             */
            if (picker === "12hours") {
                if (flag && calculatedValue.slice(1, 2) === "1" && prevIntKey === "0") {
                    return "0" + key;
                }
            }
            return !flag ? "0" + key : calculatedValue.slice(1, 2) + key;
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Tab") return;
            // Leave shortcuts (copy, select-all, devtools) to the browser.
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            e.preventDefault();

            if (e.key === "ArrowRight") return onRightFocus?.();
            if (e.key === "ArrowLeft") return onLeftFocus?.();

            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                const direction = e.key === "ArrowUp" ? step : -step;
                const newValue = getArrowByType(calculatedValue, direction, picker);
                setFlag(false);
                setDate(setDateByType(new Date(activeDate), newValue, picker, period));
                return;
            }

            if (e.key >= "0" && e.key <= "9") {
                if (picker === "12hours") setPrevIntKey(e.key);
                const newValue = calculateNewValue(e.key);
                // Second digit completes the segment — move on.
                if (flag) onRightFocus?.();
                setFlag((prev) => !prev);
                setDate(setDateByType(new Date(activeDate), newValue, picker, period));
            }
        };

        return (
            <Input
                ref={ref}
                id={id || picker}
                name={name || picker}
                disabled={disabled}
                className={cn(
                    "w-[52px] text-center font-mono text-base tabular-nums caret-transparent",
                    "focus:bg-accent focus:text-accent-foreground",
                    "[&::-webkit-inner-spin-button]:appearance-none",
                    className
                )}
                value={displayValue}
                // The value is driven entirely by keydown; onChange exists only to
                // keep React from warning about a controlled input without a handler.
                onChange={(e) => e.preventDefault()}
                type={type}
                inputMode="numeric"
                aria-label={picker === "minutes" ? "Minutes" : "Hours"}
                onFocus={(e) => {
                    e.currentTarget.select();
                    onFocus?.(e);
                }}
                onKeyDown={(e) => {
                    onKeyDown?.(e);
                    handleKeyDown(e);
                }}
                {...props}
            />
        );
    }
);

TimePickerInput.displayName = "TimePickerInput";

export { TimePickerInput };

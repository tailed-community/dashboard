import * as React from "react";

import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Period } from "./time-picker-utils";
import { display12HourValue, setDateByType } from "./time-picker-utils";

export interface PeriodSelectorProps {
    period: Period;
    setPeriod: (period: Period) => void;
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    disabled?: boolean;
    className?: string;
    onRightFocus?: () => void;
    onLeftFocus?: () => void;
}

export const TimePeriodSelect = React.forwardRef<
    HTMLButtonElement,
    PeriodSelectorProps
>(
    (
        {
            period,
            setPeriod,
            date,
            setDate,
            disabled,
            className,
            onLeftFocus,
            onRightFocus,
        },
        ref
    ) => {
        // Choosing a period before any digits are typed still matters — it is
        // the period those digits will land in — so once picked it must show,
        // even though there is no date yet to derive it from.
        const [picked, setPicked] = React.useState(false);

        const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === "ArrowRight") onRightFocus?.();
            if (e.key === "ArrowLeft") onLeftFocus?.();
        };

        const handleValueChange = (value: Period) => {
            setPeriod(value);
            setPicked(true);

            /**
             * Shift the underlying hour whenever the user switches AM/PM,
             * otherwise they would have to retype the hour every time.
             */
            if (date) {
                const hours = display12HourValue(date.getHours());
                setDate(setDateByType(new Date(date), hours, "12hours", value));
            }
        };

        return (
            <Select
                // Undefined until a real time exists, so the trigger shows the
                // placeholder instead of implying AM was chosen.
                value={date || picked ? period : undefined}
                onValueChange={handleValueChange}
                disabled={disabled}
            >
                <SelectTrigger
                    ref={ref}
                    aria-label="AM or PM"
                    className={cn(
                        "w-[68px] focus:bg-accent focus:text-accent-foreground",
                        className
                    )}
                    onKeyDown={handleKeyDown}
                >
                    <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
            </Select>
        );
    }
);

TimePeriodSelect.displayName = "TimePeriodSelect";

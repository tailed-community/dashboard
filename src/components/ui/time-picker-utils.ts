/**
 * Segment helpers for the keyboard-driven time picker.
 *
 * The picker edits a `Date` in place, one two-digit segment at a time. Every
 * helper here takes and returns a zero-padded two-character string so the input
 * value never flickers between "9" and "09" mid-edit.
 *
 * Seconds are deliberately not supported: every consumer in this app works at
 * minute precision, and an unused third segment is just one more tab stop.
 */

export type TimePickerType = "hours" | "12hours" | "minutes";
export type Period = "AM" | "PM";

/** 24-hour clock, 00-23. */
export function isValidHour(value: string) {
    return /^(0[0-9]|1[0-9]|2[0-3])$/.test(value);
}

/** 12-hour clock, 01-12. */
export function isValid12Hour(value: string) {
    return /^(0[1-9]|1[0-2])$/.test(value);
}

/** Minutes, 00-59. */
export function isValidMinute(value: string) {
    return /^[0-5][0-9]$/.test(value);
}

type GetValidNumberConfig = { max: number; min?: number; loop?: boolean };

export function getValidNumber(
    value: string,
    { max, min = 0, loop = false }: GetValidNumberConfig
) {
    let numericValue = parseInt(value, 10);

    if (Number.isNaN(numericValue)) return String(min).padStart(2, "0");

    if (loop) {
        // Wrap around so holding ArrowUp on 23:00 rolls to 00:00 rather than sticking.
        const span = max - min + 1;
        numericValue = ((((numericValue - min) % span) + span) % span) + min;
    } else {
        numericValue = Math.min(max, Math.max(min, numericValue));
    }

    return numericValue.toString().padStart(2, "0");
}

export function getValidHour(value: string) {
    if (isValidHour(value)) return value;
    return getValidNumber(value, { max: 23 });
}

export function getValid12Hour(value: string) {
    if (isValid12Hour(value)) return value;
    return getValidNumber(value, { min: 1, max: 12 });
}

export function getValidMinute(value: string) {
    if (isValidMinute(value)) return value;
    return getValidNumber(value, { max: 59 });
}

type GetValidArrowNumberConfig = { min: number; max: number; step: number };

export function getValidArrowNumber(
    value: string,
    { min, max, step }: GetValidArrowNumberConfig
) {
    const numericValue = parseInt(value, 10);
    if (Number.isNaN(numericValue)) return String(min).padStart(2, "0");
    return getValidNumber(String(numericValue + step), { min, max, loop: true });
}

export function getValidArrowHour(value: string, step: number) {
    return getValidArrowNumber(value, { min: 0, max: 23, step });
}

export function getValidArrow12Hour(value: string, step: number) {
    return getValidArrowNumber(value, { min: 1, max: 12, step });
}

export function getValidArrowMinute(value: string, step: number) {
    return getValidArrowNumber(value, { min: 0, max: 59, step });
}

export function setMinutes(date: Date, value: string) {
    date.setMinutes(parseInt(getValidMinute(value), 10));
    return date;
}

export function setHours(date: Date, value: string) {
    date.setHours(parseInt(getValidHour(value), 10));
    return date;
}

export function set12Hours(date: Date, value: string, period: Period) {
    const hours = parseInt(getValid12Hour(value), 10);
    date.setHours(convert12HourTo24Hour(hours, period));
    return date;
}

export function setDateByType(
    date: Date,
    value: string,
    type: TimePickerType,
    period?: Period
) {
    switch (type) {
        case "minutes":
            return setMinutes(date, value);
        case "hours":
            return setHours(date, value);
        case "12hours":
            if (!period) return date;
            return set12Hours(date, value, period);
        default:
            return date;
    }
}

export function getDateByType(date: Date, type: TimePickerType) {
    switch (type) {
        case "minutes":
            return getValidMinute(String(date.getMinutes()));
        case "hours":
            return getValidHour(String(date.getHours()));
        case "12hours":
            return getValid12Hour(display12HourValue(date.getHours()));
        default:
            return "00";
    }
}

export function getArrowByType(
    value: string,
    step: number,
    type: TimePickerType
) {
    switch (type) {
        case "minutes":
            return getValidArrowMinute(value, step);
        case "hours":
            return getValidArrowHour(value, step);
        case "12hours":
            return getValidArrow12Hour(value, step);
        default:
            return "00";
    }
}

/**
 * 12:00 PM is 12:00, 12:00 AM is 00:00.
 */
export function convert12HourTo24Hour(hour: number, period: Period) {
    if (period === "PM") return hour === 12 ? 12 : hour + 12;
    return hour === 12 ? 0 : hour;
}

/**
 * Time is stored on the Date in 24-hour form but shown to the user as a
 * zero-padded 12-hour string.
 */
export function display12HourValue(hours: number) {
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return String(hour12).padStart(2, "0");
}

export function getPeriod(date: Date): Period {
    return date.getHours() >= 12 ? "PM" : "AM";
}

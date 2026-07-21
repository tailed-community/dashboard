import { DateTime } from "luxon";

/**
 * The events API stores day and time as two separate strings ("yyyy-MM-dd" and
 * "HH:mm"), while the pickers work in a single `Date`. These two functions are
 * the only place that split happens, so the forms can hold one value per
 * instant and convert at the network boundary.
 *
 * Both sides work in the browser's local zone, matching how the user reads the
 * times they typed.
 */

const ISO_DATE = "yyyy-MM-dd";
const WIRE_TIME = "HH:mm";

export function splitWireDateTime(date: Date): { date: string; time: string } {
    const dt = DateTime.fromJSDate(date);
    return { date: dt.toFormat(ISO_DATE), time: dt.toFormat(WIRE_TIME) };
}

/**
 * Rebuild a `Date` from the API's two fields. Returns undefined when the day is
 * missing or unparseable; a missing time falls back to midnight so a
 * date-without-time record still loads instead of blanking the field.
 */
export function joinWireDateTime(
    date?: string | null,
    time?: string | null
): Date | undefined {
    if (!date) return undefined;
    const day = DateTime.fromFormat(date, ISO_DATE);
    if (!day.isValid) return undefined;

    const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? "").trim());
    if (!match) return day.startOf("day").toJSDate();

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return day.startOf("day").toJSDate();

    return day.set({ hour, minute }).toJSDate();
}

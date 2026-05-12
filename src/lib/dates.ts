import { DateTime } from "luxon";

export function parseToDateTime(input?: unknown): DateTime {

  if (input == null) return DateTime.invalid("null");

  // Firebase Timestamp-like object
  try {
    if (typeof input === "object") {
      // Firestore Timestamp has toDate()
      if (typeof (input as any).toDate === "function") {
        return DateTime.fromJSDate((input as any).toDate());
      }

      if (input instanceof Date) return DateTime.fromJSDate(input);

      // Some server payloads use { seconds, nanoseconds } or Firestore serializes as {_seconds, _nanoseconds}
      const anyInput = input as any;
      const sec = typeof anyInput.seconds === "number" ? anyInput.seconds : (typeof anyInput._seconds === "number" ? anyInput._seconds : null);
      const nano = typeof anyInput.nanoseconds === "number" ? anyInput.nanoseconds : (typeof anyInput._nanoseconds === "number" ? anyInput._nanoseconds : null);
      if (sec !== null && nano !== null) {
        const ms = sec * 1000 + Math.floor(nano / 1e6);
        return DateTime.fromMillis(ms);
      }
    }
  } catch (e) {
    // fallthrough to string parsing
  }

  if (typeof input === "number") return DateTime.fromMillis(input);

  const str = String(input);

  // Try ISO first
  const iso = DateTime.fromISO(str);
  if (iso.isValid) return iso;

  // Try RFC2822
  const rfc = DateTime.fromRFC2822(str);
  if (rfc.isValid) return rfc;

  // Try JS Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return DateTime.fromJSDate(d);

  // Some stored strings include non-breaking spaces — normalize and retry
  const cleaned = str.replace(/\u202F|\u00A0/g, " ");
  const iso2 = DateTime.fromISO(cleaned);
  if (iso2.isValid) return iso2;
  const rfc2 = DateTime.fromRFC2822(cleaned);
  if (rfc2.isValid) return rfc2;
  const d2 = new Date(cleaned);
  if (!isNaN(d2.getTime())) return DateTime.fromJSDate(d2);

  return DateTime.invalid("unparsable");
}

export function formatDate(input: unknown, fmt = "MMM dd, yyyy") {
  const dt = parseToDateTime(input);
  if (dt.isValid) return dt.toFormat(fmt);

  // If parsing failed, try to show the original value for debugging
  if (input == null) return "—";
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }

  // Firestore timestamp-like objects may stringify poorly; try to call toDate/toMillis if available
  try {
    if (typeof (input as any).toDate === "function") return (input as any).toDate().toISOString();
    if (typeof (input as any).toMillis === "function") return new Date((input as any).toMillis()).toISOString();
  } catch (e) {
    // ignore
  }

  return "—";
}

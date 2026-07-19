import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DateTime } from "luxon";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, MapPin, Building2, CalendarIcon, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/** Joy-styled native button that (unlike PlaygroundButton) supports disabled +
 *  loading spinners — used for the confirm / cancel / reschedule flows. */
const joyBtnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:cursor-not-allowed disabled:opacity-50";
const joyBtnVariants: Record<string, string> = {
  primary:
    "bg-joy-grass text-white shadow-[0_3px_0_var(--joy-grass-deep)] hover:brightness-105 active:translate-y-[2px]",
  outline: "border-2 border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50",
  danger: "border-2 border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50",
};

interface TimeBlock {
  id: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

interface BookingData {
  token: string;
  jobTitle: string;
  jobLocation: string;
  organizationName: string;
  availabilityBlocks: TimeBlock[];
  availabilityMeta?: any; // contains config.duration
  existingBookings: {
    scheduledStart: any;
    scheduledEnd: any;
  }[];
  existingBooking?: any | null;
  expiresAt?: any;
}

interface TimeSlot {
  id?: string;
  start: Date;
  end: Date;
  available: boolean;
}

export default function BookingPage() {
  const { code } = useParams<{ code: string }>();

  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!dataLoaded) {
      loadBookingData();
    }
  }, [code, dataLoaded]);

  const loadBookingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use plain fetch for public booking link (no auth required)
      // Use companies API for booking endpoints
      const apiUrl = import.meta.env.VITE_COMPANIES_API_URL || "";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`${apiUrl}/bookings/link/${code}`, {
        headers: { "x-timezone": timezone },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load booking information");
      }

      const data = await response.json();
      setBookingData(data);
      setDataLoaded(true);

      // Check if there's already a booking for this application
      if (data.existingBooking) {
        setSuccess(true);
        // Reconstruct the selected slot from existing booking
        setSelectedSlot({
          start: DateTime.fromISO(data.existingBooking.scheduledStart).toJSDate(),
          end: DateTime.fromISO(data.existingBooking.scheduledEnd).toJSDate(),
          available: true,
        });
      } else {
        // Set default selected date to the first available date (if any)
        const first = getFirstAvailableDate(data);
        if (first) {
          setSelectedDate(first);
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          setSelectedDate(today);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFirstAvailableDate = (data: BookingData | null): Date | undefined => {
    if (!data || !data.availabilityBlocks || data.availabilityBlocks.length === 0) return undefined;
    const now = new Date();
    const candidates = data.availabilityBlocks
      .map(b => new Date(b.startTime))
      .filter(d => d > now)
      .sort((a, b) => a.getTime() - b.getTime());

    if (candidates.length === 0) return undefined;
    const first = new Date(candidates[0]);
    first.setHours(0, 0, 0, 0);
    return first;
  };

  const generateTimeSlots = (): TimeSlot[] => {
    if (!bookingData || !selectedDate || !bookingData.availabilityBlocks) return [];

    const slots: TimeSlot[] = [];
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();

    // Determine slot duration from availabilityMeta, fallback to 30
    const duration = bookingData.availabilityMeta?.config?.duration ?? 30;

    (bookingData.availabilityBlocks || []).forEach(block => {
      if (!block || !block.startTime || !block.endTime) return;
      const start = new Date(block.startTime);
      const end = new Date(block.endTime);

      if (
        start.getFullYear() !== selectedYear ||
        start.getMonth() !== selectedMonth ||
        start.getDate() !== selectedDay
      ) return;

      // Build one or more slots inside this block depending on duration
      let cursor = new Date(start);
      while (cursor.getTime() + duration * 60 * 1000 <= end.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + duration * 60 * 1000);

        const isPast = slotEnd <= new Date();

        slots.push({
          id: block.id,
          start: slotStart,
          end: slotEnd,
          available: !isPast,
        });

        cursor = new Date(cursor.getTime() + duration * 60 * 1000);
      }
    });

    return slots;
  };

  const handleBookSlot = async () => {
    if (!selectedSlot || !bookingData) return;

    try {
      setBooking(true);

      // Use plain fetch for public booking link (no auth required)
      // Use companies API for booking endpoints
      const apiUrl = import.meta.env.VITE_COMPANIES_API_URL || "";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`${apiUrl}/bookings/link/${code}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-timezone": timezone },
        body: JSON.stringify({
          scheduledStart: selectedSlot.start.toISOString(),
          scheduledEnd: selectedSlot.end.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to book interview");
      }

      await response.json();
      setSuccess(true);
    } catch (err: any) {
      toast.error("Failed to book interview. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleCancelBooking = async () => {
    try {
      setCancelling(true);
      const apiUrl = import.meta.env.VITE_COMPANIES_API_URL || "";
      const response = await fetch(`${apiUrl}/bookings/${code}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel booking");
      }

      // Reset to initial state to allow rebooking
      setSuccess(false);
      setSelectedSlot(null);
      await loadBookingData(); // Refresh availability
    } catch (err: any) {
      toast.error("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = () => {
    // Reset to booking interface - the auto-cancel logic in the backend
    // will handle deleting the old booking when a new time is selected
    setSuccess(false);
    setSelectedSlot(null);

    // Clear existing booking from state so we don't get redirected back if logic re-runs
    if (bookingData) {
      setBookingData({
        ...bookingData,
        existingBooking: undefined
      } as any);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-joy-grass" />
        <p className="mt-3 text-sm font-medium text-joy-ink-muted">
          Loading booking information...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-joy-grass/10">
              <CheckCircle2 className="h-6 w-6 text-joy-grass" />
            </div>
            <h1 className="joy-display text-2xl font-extrabold text-joy-ink">Interview Scheduled!</h1>
            <p className="mt-1 text-sm text-joy-ink-muted">
              Your interview has been successfully booked
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {selectedSlot && (
              <div className="space-y-2 rounded-xl border border-joy-ink/8 bg-joy-surface p-4">
                <div className="flex items-center gap-2 text-sm text-joy-ink">
                  <CalendarIcon className="h-4 w-4 text-joy-ink-muted" />
                  <span className="font-bold">{formatDate(selectedSlot.start)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-joy-ink">
                  <Clock className="h-4 w-4 text-joy-ink-muted" />
                  <span>
                    {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                  </span>
                </div>
                {bookingData && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-joy-ink">
                      <Building2 className="h-4 w-4 text-joy-ink-muted" />
                      <span>{bookingData.organizationName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-joy-ink">
                      <MapPin className="h-4 w-4 text-joy-ink-muted" />
                      <span>{bookingData.jobLocation}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-center text-sm text-joy-ink-muted">
              You will receive a confirmation email with the interview details and a calendar invite.
            </p>
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={handleReschedule}
                className={`${joyBtnBase} ${joyBtnVariants.outline} flex-1`}
                disabled={cancelling}
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                className={`${joyBtnBase} ${joyBtnVariants.danger} flex-1`}
                disabled={cancelling}
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel Interview
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bookingData) return null;

  const availableSlots = generateTimeSlots();
  const slotDuration = bookingData?.availabilityMeta?.config?.duration ?? 30;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8">
        <h1 className="joy-display mb-2 text-3xl font-extrabold text-joy-ink">Schedule Your Interview</h1>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-joy-ink-muted">
            <Building2 className="h-4 w-4" />
            <span>{bookingData.organizationName}</span>
          </div>
          <div className="flex items-center gap-2 text-joy-ink-muted">
            <CalendarIcon className="h-4 w-4" />
            <span>{bookingData.jobTitle}</span>
          </div>
          <div className="flex items-center gap-2 text-joy-ink-muted">
            <MapPin className="h-4 w-4" />
            <span>{bookingData.jobLocation}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Calendar Section */}
        <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="joy-display text-lg font-extrabold text-joy-ink">Select a Date</h2>
            <p className="text-sm text-joy-ink-muted">
              Choose a date to see available time slots
            </p>
          </div>
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Disable past dates
                if (date < today) return true;

                // Disable dates more than 2 weeks out
                const twoWeeksOut = new Date();
                twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
                if (date > twoWeeksOut) return true;

                // Disable dates that have no availability blocks
                if (!bookingData || !bookingData.availabilityBlocks) return true;

                const hasAvailability = (bookingData.availabilityBlocks || []).some(block => {
                  if (!block || !block.startTime) return false;
                  const start = new Date(block.startTime);
                  return (
                    start.getFullYear() === date.getFullYear() &&
                    start.getMonth() === date.getMonth() &&
                    start.getDate() === date.getDate()
                  );
                });

                return !hasAvailability;
              }}
              className="rounded-md border"
            />
          </div>
        </div>

        {/* Time Slots Section */}
        <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="joy-display text-lg font-extrabold text-joy-ink">Available Time Slots</h2>
            <p className="text-sm text-joy-ink-muted">
              {selectedDate
                ? `${formatDate(selectedDate)} - Select a ${slotDuration}-minute slot`
                : "Select a date to see available times"}
            </p>
          </div>
          <div>
            {!selectedDate ? (
              <div className="py-12 text-center text-joy-ink-muted">
                <CalendarIcon className="mx-auto mb-2 h-12 w-12 opacity-40" />
                <p>Please select a date</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="py-12 text-center text-joy-ink-muted">
                <Clock className="mx-auto mb-2 h-12 w-12 opacity-40" />
                <p>No available time slots for this date</p>
              </div>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => slot.available && setSelectedSlot(slot)}
                    disabled={!slot.available}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedSlot === slot
                      ? "border-joy-grass bg-joy-grass/10 text-joy-ink cursor-pointer"
                      : slot.available
                        ? "border-joy-ink/12 hover:border-joy-grass/50 hover:bg-joy-grass-bright/8 cursor-pointer"
                        : "cursor-not-allowed border-joy-ink/8 bg-joy-surface opacity-50"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-bold">
                          {formatTime(slot.start)} - {formatTime(slot.end)}
                        </span>
                      </div>
                      {!slot.available && (
                        <span className="text-xs text-joy-ink-muted">Unavailable</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Section */}
      {selectedSlot && (
        <div className="mt-6 rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm">
          <h2 className="joy-display mb-4 text-lg font-extrabold text-joy-ink">Confirm Your Booking</h2>
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-joy-ink/8 bg-joy-surface p-4">
              <div className="flex items-center gap-2 text-joy-ink">
                <CalendarIcon className="h-4 w-4 text-joy-ink-muted" />
                <span className="font-bold">{formatDate(selectedSlot.start)}</span>
              </div>
              <div className="flex items-center gap-2 text-joy-ink">
                <Clock className="h-4 w-4 text-joy-ink-muted" />
                <span>
                  {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)} ({slotDuration} minutes)
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBookSlot}
                disabled={booking}
                className={`${joyBtnBase} ${joyBtnVariants.primary} flex-1`}
              >
                {booking && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Booking
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                disabled={booking}
                className={`${joyBtnBase} ${joyBtnVariants.outline}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


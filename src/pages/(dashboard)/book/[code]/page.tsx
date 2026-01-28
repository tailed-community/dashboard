import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MapPin, Building2, CalendarIcon, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [bookingId, setBookingId] = useState<string | null>(null);
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
        setBookingId(data.existingBooking.bookingId);
        // Reconstruct the selected slot from existing booking
        setSelectedSlot({
          start: new Date(data.existingBooking.scheduledStart._seconds * 1000),
          end: new Date(data.existingBooking.scheduledEnd._seconds * 1000),
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

      const result = await response.json();
      setBookingId(result.bookingId);
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
    if (!bookingId) return;

    try {
      setCancelling(true);
      const apiUrl = import.meta.env.VITE_COMPANIES_API_URL || "";
      const response = await fetch(`${apiUrl}/bookings/${bookingId}/cancel`, {
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
      setBookingId(null);
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
    setBookingId(null);

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="relative">
          <div className="h-12 w-12 border-4 border-gray-300 rounded-full"></div>
          <div className="absolute top-0 left-0 h-12 w-12 border-4 border-t-primary border-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-600 animate-pulse">
          Loading booking information...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Interview Scheduled!</CardTitle>
            <CardDescription>
              Your interview has been successfully booked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSlot && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-medium">{formatDate(selectedSlot.start)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>
                    {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                  </span>
                </div>
                {bookingData && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>{bookingData.organizationName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>{bookingData.jobLocation}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              You will receive a confirmation email with the interview details and a calendar invite.
            </p>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleReschedule}
                variant="outline"
                className="flex-1 cursor-pointer"
                disabled={cancelling}
              >
                Reschedule
              </Button>
              <Button
                onClick={handleCancelBooking}
                variant="destructive"
                className="flex-1 cursor-pointer"
                disabled={cancelling}
              >
                {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel Interview
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bookingData) return null;

  const availableSlots = generateTimeSlots();
  const slotDuration = bookingData?.availabilityMeta?.config?.duration ?? 30;

  return (
    <div className="container mx-auto py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Schedule Your Interview</h1>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{bookingData.organizationName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>{bookingData.jobTitle}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{bookingData.jobLocation}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Select a Date</CardTitle>
            <CardDescription>
              Choose a date to see available time slots
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Time Slots Section */}
        <Card>
          <CardHeader>
            <CardTitle>Available Time Slots</CardTitle>
            <CardDescription>
              {selectedDate
                ? `${formatDate(selectedDate)} - Select a ${slotDuration}-minute slot`
                : "Select a date to see available times"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Please select a date</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No available time slots for this date</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => slot.available && setSelectedSlot(slot)}
                    disabled={!slot.available}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${selectedSlot === slot
                      ? "bg-primary text-primary-foreground border-primary cursor-pointer"
                      : slot.available
                        ? "hover:bg-muted border-border cursor-pointer"
                        : "opacity-50 cursor-not-allowed bg-muted"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {formatTime(slot.start)} - {formatTime(slot.end)}
                        </span>
                      </div>
                      {!slot.available && (
                        <span className="text-xs">Unavailable</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Section */}
      {selectedSlot && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Confirm Your Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="font-medium">{formatDate(selectedSlot.start)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)} ({slotDuration} minutes)
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleBookSlot}
                disabled={booking}
                className="flex-1 cursor-pointer"
              >
                {booking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Booking
              </Button>
              <Button
                onClick={() => setSelectedSlot(null)}
                variant="outline"
                disabled={booking}
                className="cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


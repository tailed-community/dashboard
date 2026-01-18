import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MapPin, Building2, CalendarIcon, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface TimeBlock {
  id: string;
  day: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  weekStart: string; // YYYY-MM-DD format (start of week this block belongs to)
}

interface BookingData {
  token: string;
  jobTitle: string;
  jobLocation: string;
  organizationName: string;
  availabilityBlocks: TimeBlock[];
  existingBookings: {
    scheduledStart: any;
    scheduledEnd: any;
  }[];
  expiresAt: any;
}

interface TimeSlot {
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
      const response = await fetch(`${apiUrl}/bookings/link/${code}`);

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
        // Set default selected date to today or next available date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setSelectedDate(today);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (): TimeSlot[] => {
    if (!bookingData || !selectedDate || !bookingData.availabilityBlocks) return [];

    const slots: TimeSlot[] = [];
    const dayOfWeek = selectedDate.getDay();

    // Calculate which week the selected date belongs to (Sunday = start of week)
    const selectedWeekStart = new Date(selectedDate);
    selectedWeekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
    selectedWeekStart.setHours(0, 0, 0, 0);
    const selectedWeekId = selectedWeekStart.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find availability blocks for selected day AND week
    const dayBlocks = (bookingData.availabilityBlocks || []).filter(
      block => {
        if (!block || !block.startTime || !block.endTime) return false;
        // Must match both day of week AND the specific week
        return block.day === dayOfWeek && block.weekStart === selectedWeekId;
      }
    );

    if (dayBlocks.length === 0) return [];

    // Generate 30-minute slots for each availability block
    dayBlocks.forEach(block => {
      // Safeguard: ensure startTime and endTime exist and are strings
      if (!block || typeof block.startTime !== 'string' || typeof block.endTime !== 'string') {
        return;
      }

      // Additional check for valid time format
      if (!block.startTime.includes(':') || !block.endTime.includes(':')) {
        return;
      }

      const [startHour, startMinute] = block.startTime.split(":").map(Number);
      const [endHour, endMinute] = block.endTime.split(":").map(Number);

      // Validate parsed numbers
      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
        return;
      }

      // Round start time UP to next :00 or :30
      let slotStartHour = startHour;
      let slotStartMinute = 0;
      if (startMinute > 0 && startMinute <= 30) {
        slotStartMinute = 30;
      } else if (startMinute > 30) {
        slotStartHour += 1;
        slotStartMinute = 0;
      }

      // Round end time DOWN to previous :00 or :30
      let slotEndHour = endHour;
      let slotEndMinute = 0;
      if (endMinute >= 30) {
        slotEndMinute = 30;
      } else if (endMinute > 0) {
        slotEndHour -= 1;
        slotEndMinute = 30;
      }

      let currentTime = new Date(selectedDate);
      currentTime.setHours(slotStartHour, slotStartMinute, 0, 0);

      const blockEnd = new Date(selectedDate);
      blockEnd.setHours(slotEndHour, slotEndMinute, 0, 0);

      // Skip if the block doesn't allow at least one 30-min slot
      if (currentTime >= blockEnd) return;

      while (currentTime < blockEnd) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);

        // Stop if this slot would exceed the block's end time
        if (slotEnd > blockEnd) break;

        // Check if slot is in the past
        const isPast = slotEnd <= new Date();

        // Check if slot conflicts with existing bookings
        // Note: Calendar event conflicts are already handled by the backend
        // which splits availability blocks around calendar events before sending them
        const hasConflict = (bookingData.existingBookings || []).some(booking => {
          if (!booking || !booking.scheduledStart || !booking.scheduledEnd) return false;
          const existingStart = new Date(booking.scheduledStart._seconds * 1000);
          const existingEnd = new Date(booking.scheduledEnd._seconds * 1000);

          return (
            (slotStart >= existingStart && slotStart < existingEnd) ||
            (slotEnd > existingStart && slotEnd <= existingEnd) ||
            (slotStart <= existingStart && slotEnd >= existingEnd)
          );
        });

        if (slotEnd <= blockEnd) {
          slots.push({
            start: slotStart,
            end: slotEnd,
            available: !isPast && !hasConflict,
          });
        }

        currentTime.setMinutes(currentTime.getMinutes() + 30);
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
      const response = await fetch(`${apiUrl}/bookings/link/${code}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      alert(err.message || "Failed to book interview. Please try again.");
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
      alert(err.message || "Failed to cancel booking. Please try again.");
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

                // Disable days with no availability for THIS specific week
                const dayOfWeek = date.getDay();
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const weekId = weekStart.toISOString().split('T')[0];

                const hasAvailability = (bookingData.availabilityBlocks || []).some(
                  block => block && block.day === dayOfWeek && block.weekStart === weekId
                );

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
                ? `${formatDate(selectedDate)} - Select a 30-minute slot`
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
                  {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)} (30 minutes)
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


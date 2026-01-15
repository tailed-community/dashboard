import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Users as UsersIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";

type Event = {
    id: string;
    title: string;
    datetime: Date;
    category: string;
    attendees: number;
};

type AttendeePreview = {
    email: string;
    firstName?: string;
    lastName?: string;
    status: "new" | "existing" | "invalid";
    error?: string;
};

type ImportResult = {
    created: string[];
    existing: string[];
    registered?: string[];  // For event attendees
    added?: string[];       // For community members
    alreadyMembers?: string[]; // For community members
    errors: { email: string; error: string }[];
};

interface EventAttendeesTabProps {
    communityId: string;
}

export default function EventAttendeesTab({ communityId }: EventAttendeesTabProps) {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [pastedEmails, setPastedEmails] = useState<string>("");
    const [attendeesPreview, setAttendeesPreview] = useState<AttendeePreview[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoadingEvents(true);
                
                // Fetch events via API
                const response = await apiFetch(`/communities/${communityId}/events`);
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.error || "Failed to load events");
                }

                // Convert datetime strings to Date objects
                const eventsData: Event[] = result.events.map((event: any) => ({
                    ...event,
                    datetime: new Date(event.datetime),
                }));

                setEvents(eventsData);
            } catch (error) {
                console.error("Error fetching events:", error);
                toast.error("Failed to load events");
            } finally {
                setLoadingEvents(false);
            }
        };

        if (communityId) {
            fetchEvents();
        }

        // Cleanup debounce timer on unmount
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [communityId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setPastedEmails(""); // Clear pasted emails when file is selected
        setImportResult(null);
        parseFile(selectedFile);
    };

    const handlePastedEmailsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setPastedEmails(text);
        setFile(null); // Clear file when pasting
        setImportResult(null);
        
        // Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        
        if (text.trim()) {
            parseText(text, false); // Don't show toast immediately
            
            // Set new debounce timer for toast notification
            debounceTimerRef.current = setTimeout(() => {
                const validCount = attendeesPreview.filter(a => a.status !== "invalid").length;
                if (validCount > 0) {
                    toast.success(`Found ${validCount} valid attendee${validCount !== 1 ? 's' : ''}`);
                }
            }, 5000); // 5 second delay
        } else {
            setAttendeesPreview([]);
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = "email,firstName,lastName\njohn.doe@example.com,John,Doe\njane.smith@example.com,Jane,Smith";
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "attendee-template.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Template downloaded!");
    };

    const parseText = (text: string, showToast: boolean = true) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        const attendees: AttendeePreview[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip header row if it looks like a header
            if (i === 0 && (line.toLowerCase().includes('email') || line.toLowerCase().includes('name'))) {
                continue;
            }

            if (!line) continue;

            // Check if line contains commas (CSV format)
            if (line.includes(',')) {
                const parts = line.split(',').map(p => p.trim().replace(/['"]/g, ''));
                const email = parts[0];
                const firstName = parts[1] || undefined;
                const lastName = parts[2] || undefined;

                if (emailRegex.test(email)) {
                    attendees.push({
                        email,
                        firstName,
                        lastName,
                        status: "new",
                    });
                } else {
                    attendees.push({
                        email,
                        firstName,
                        lastName,
                        status: "invalid",
                        error: "Invalid email format",
                    });
                }
            } else {
                // Plain email
                const email = line;
                if (emailRegex.test(email)) {
                    attendees.push({
                        email,
                        status: "new",
                    });
                } else {
                    attendees.push({
                        email,
                        status: "invalid",
                        error: "Invalid email format",
                    });
                }
            }
        }

        setAttendeesPreview(attendees);
        
        if (showToast) {
            if (attendees.length === 0) {
                toast.error("No valid attendees found");
            } else {
                const validCount = attendees.filter(a => a.status !== "invalid").length;
                toast.success(`Found ${validCount} valid attendee${validCount !== 1 ? 's' : ''}`);
            }
        }
    };

    const parseFile = async (file: File) => {
        try {
            const text = await file.text();
            parseText(text, true); // Show toast immediately for file upload
        } catch (error) {
            console.error("Error parsing file:", error);
            toast.error("Failed to parse file");
        }
    };

    const handleImport = async () => {
        if (attendeesPreview.length === 0) {
            toast.error("No attendees to import");
            return;
        }

        const validAttendees = attendeesPreview.filter(a => a.status !== "invalid");
        if (validAttendees.length === 0) {
            toast.error("No valid attendees to import");
            return;
        }

        try {
            setIsProcessing(true);

            let response;
            let successMessage;

            if (selectedEventId && selectedEventId !== "community-only") {
                // Import as event attendees
                response = await apiFetch(`/events/${selectedEventId}/import-attendees`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        attendees: validAttendees.map(a => ({
                            email: a.email,
                            firstName: a.firstName,
                            lastName: a.lastName,
                        })),
                        sendNotifications: false,
                    }),
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "Failed to import attendees");
                }

                const result = await response.json();
                setImportResult(result.results);

                successMessage = 
                    `Successfully imported ${result.results.registered.length} attendees! ` +
                    `(${result.results.created.length} new accounts created)`;
            } else {
                // Import as community members
                response = await apiFetch(`/communities/${communityId}/import-members`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        members: validAttendees.map(a => ({
                            email: a.email,
                            firstName: a.firstName,
                            lastName: a.lastName,
                        })),
                        sendNotifications: false,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "Failed to import members");
                }

                const result = await response.json();
                setImportResult(result.results);

                successMessage = 
                    `Successfully added ${result.results.added.length} members! ` +
                    `(${result.results.created.length} new accounts created)`;
            }

            toast.success(successMessage);

            // Clear file, pasted emails, and preview
            setFile(null);
            setPastedEmails("");
            setAttendeesPreview([]);
            
            // Refresh events to update attendee/member count
            try {
                const response = await apiFetch(`/communities/${communityId}/events`);
                const result = await response.json();
                
                if (response.ok) {
                    const eventsData: Event[] = result.events.map((event: any) => ({
                        ...event,
                        datetime: new Date(event.datetime),
                    }));
                    setEvents(eventsData);
                }
            } catch (error) {
                console.error("Error refreshing events:", error);
            }

        } catch (error: any) {
            console.error("Error importing attendees:", error);
            toast.error(error.message || "Failed to import attendees");
        } finally {
            setIsProcessing(false);
        }
    };

    if (loadingEvents) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Event Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Import Members & Event Attendees</CardTitle>
                    <CardDescription>
                        Add members to your community or register attendees for a specific event.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Select Event */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Select Event <span className="text-slate-500">(Optional)</span>
                        </label>
                        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Add to community only (no event)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="community-only">
                                    <div className="flex items-center gap-2">
                                        <UsersIcon className="h-4 w-4" />
                                        <span>Add to community only</span>
                                    </div>
                                </SelectItem>
                                {events.map((event) => (
                                    <SelectItem key={event.id} value={event.id}>
                                        <div className="flex items-center gap-2">
                                            <span>{event.title}</span>
                                            <Badge variant="secondary" className="ml-2">
                                                {event.attendees} attendees
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            {selectedEventId && selectedEventId !== "community-only"
                                ? "Members will be registered for the selected event"
                                : "Members will be added to the community without event registration"
                            }
                        </p>
                    </div>

                    {/* Download Template */}
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900">Need a template?</p>
                            <p className="text-xs text-blue-700 mt-1">
                                Download our CSV template with sample data
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadTemplate}
                            className="bg-white"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                    </div>

                    {/* File Upload or Paste Options */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-xs text-slate-500 font-medium">CHOOSE METHOD</span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Option 1: Upload File</label>
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    className="w-full"
                                    disabled={!!pastedEmails}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {file ? file.name : "Choose CSV or TXT file"}
                                </Button>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                CSV format: email, firstName, lastName (firstName and lastName are optional)
                            </p>
                        </div>

                        {/* Paste Emails */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Option 2: Paste Emails</label>
                            <Textarea
                                placeholder="Paste emails here (one per line or CSV format)&#10;john.doe@example.com&#10;jane.smith@example.com,Jane,Smith&#10;bob@example.com"
                                value={pastedEmails}
                                onChange={handlePastedEmailsChange}
                                disabled={!!file}
                                rows={6}
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500">
                                One email per line, or CSV format with optional first and last names
                            </p>
                        </div>
                    </div>

                    {/* Import Button */}
                    {attendeesPreview.length > 0 && (
                        <Button
                            onClick={handleImport}
                            disabled={isProcessing}
                            className="w-full"
                            size="lg"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    {selectedEventId && selectedEventId !== "community-only"
                                        ? `Import ${attendeesPreview.filter(a => a.status !== "invalid").length} Attendees`
                                        : `Add ${attendeesPreview.filter(a => a.status !== "invalid").length} Members`
                                    }
                                </>
                            )}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Preview Table */}
            {attendeesPreview.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Preview ({attendeesPreview.length} attendees)</CardTitle>
                        <CardDescription>
                            Review attendees before importing
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>First Name</TableHead>
                                        <TableHead>Last Name</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {attendeesPreview.map((attendee, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-mono text-sm">
                                                {attendee.email}
                                            </TableCell>
                                            <TableCell>{attendee.firstName || "-"}</TableCell>
                                            <TableCell>{attendee.lastName || "-"}</TableCell>
                                            <TableCell>
                                                {attendee.status === "invalid" ? (
                                                    <Badge variant="destructive">
                                                        <AlertCircle className="h-3 w-3 mr-1" />
                                                        Invalid
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">
                                                        <FileText className="h-3 w-3 mr-1" />
                                                        Ready
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Import Results */}
            {importResult && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Import Complete
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <p className="text-2xl font-bold text-green-700">
                                    {importResult.created.length}
                                </p>
                                <p className="text-sm text-green-600">New Accounts</p>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <p className="text-2xl font-bold text-blue-700">
                                    {importResult.existing.length}
                                </p>
                                <p className="text-sm text-blue-600">Existing Accounts</p>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                                <p className="text-2xl font-bold text-purple-700">
                                    {importResult.registered?.length || importResult.added?.length || 0}
                                </p>
                                <p className="text-sm text-purple-600">
                                    {importResult.registered ? "Registered" : "Added"}
                                </p>
                            </div>
                        </div>

                        {importResult.alreadyMembers && importResult.alreadyMembers.length > 0 && (
                            <div className="p-4 bg-yellow-50 rounded-lg">
                                <p className="font-semibold text-yellow-800 mb-2">
                                    Already Members ({importResult.alreadyMembers.length})
                                </p>
                                <p className="text-sm text-yellow-600">
                                    These users were already members of the community
                                </p>
                            </div>
                        )}

                        {importResult.errors.length > 0 && (
                            <div className="p-4 bg-red-50 rounded-lg">
                                <p className="font-semibold text-red-800 mb-2">
                                    Errors ({importResult.errors.length})
                                </p>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {importResult.errors.map((error, index) => (
                                        <p key={index} className="text-sm text-red-600">
                                            {error.email}: {error.error}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

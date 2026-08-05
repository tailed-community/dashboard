import type React from "react";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
    Upload,
    Loader2,
    Github,
    Linkedin,
    Globe,
    GraduationCap,
    User,
    Code,
    FileText,
    PencilLine,
    X,
    CheckCircle2,
    Circle,
    Trophy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { fetchGithubUserProfile } from "@/lib/github";
import { studentAuth, initializeStudentSession } from "@/lib/auth";
import { onIdTokenChanged } from "firebase/auth";
import {
    connectGithubForUser,
    GITHUB_ALREADY_LINKED_MESSAGE,
    GITHUB_USER_MISMATCH_MESSAGE,
} from "@/lib/github-link";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getFileUrl } from "@/lib/firebase-client";
import { trackEvent } from "@/lib/analytics";
import { Seo } from "@/components/seo";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { AccountOnboardingCard } from "@/components/account/account-onboarding-card";
import { ResumeQuickStart } from "@/components/account/resume-quick-start";
import { prepareResumeFile, uploadResume } from "@/lib/resume-parse";
import { EducationEditor } from "@/components/account/education-editor";
import { ExperienceEditor } from "@/components/account/experience-editor";
import { ProjectsEditor } from "@/components/account/projects-editor";
import { WorkAuthorizationEditor } from "@/components/account/work-authorization-editor";
import { SkillsStructuredEditor } from "@/components/account/skills-structured-editor";
import { LanguagePreference } from "@/components/account/language-preference";
import {
    updateProfileFields,
    calculateProfileScore,
    pickWritableProfileFields,
    type ProfileCompletion,
    type StudentProfile,
} from "@/lib/profile";

// The canonical profile shape now lives in `src/lib/profile.ts` (spec 08 §4.8).
// Kept as a local alias so the rest of this file keeps compiling unchanged.
type StudentProps = StudentProfile;

type ActivityEvent = {
    id: string;
    slug?: string;
    title: string;
    description?: string;
    heroImage?: string | null;
    heroImageUrl?: string | null;
    startDate?: string;
    mode?: string;
    location?: string;
};

type ParticipationItem = {
    type: "participation";
    event: ActivityEvent;
};

type WinItem = {
    type: "win";
    event: ActivityEvent;
    award: {
        id: string;
        type?: string;
        place: number | null;
        title: string;
        prizeDescription?: string;
    };
};

// API service functions
const apiService = {
    getStudent: async () => {
        try {
            const response = await apiFetch("/profile");
            if (!response.ok) throw new Error("Failed to fetch profile");
            return await response.json();
        } catch (error) {
            console.error("Error fetching profile:", error);
            throw error;
        }
    },
    /**
     * Persist the editable slice of the profile. Only `WRITABLE_PROFILE_FIELDS`
     * are sent — never the whole `student` state. Posting the full object is what
     * let a stale in-memory `email` be written onto another account's profile
     * doc after a mid-session account switch.
     */
    updateStudent: async (studentData: StudentProps) => {
        try {
            const response = await apiFetch("/profile/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pickWritableProfileFields(studentData)),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message || "Failed to update profile"
                );
            }
            return await response;
        } catch (error) {
            console.error("Error updating profile:", error);
            throw error;
        }
    },
};

/* ------------------------------------------------------------------ *
 * Joy layout primitives (Slice 2). Small, local helpers so the calm  *
 * single-scroll account page reads consistently: white/cream section *
 * cards on the joy-surface page bg, joy-display headings, chunky      *
 * buttons. No shadcn Card/Tabs/Button chrome here anymore.            *
 * ------------------------------------------------------------------ */

/** White section card with the joy border + soft shadow. */
function JoyCard({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm ${className}`}
        >
            {children}
        </div>
    );
}

/** A top-level section: joy-display heading (+ optional anchor id) then content. */
function Section({
    id,
    icon,
    title,
    description,
    children,
}: {
    id?: string;
    icon?: ReactNode;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-24">
            <div className="mb-4 flex items-center gap-3">
                {icon && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-joy-grass/10 text-joy-grass">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <h2 className="joy-display text-2xl font-extrabold leading-tight text-joy-ink">
                        {title}
                    </h2>
                    {description && (
                        <p className="text-sm text-joy-ink-muted">{description}</p>
                    )}
                </div>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

/** Chunky, joy-styled action button that (unlike PlaygroundButton) supports
 *  disabled + a loading spinner — used for connect/verify/upload/delete flows. */
function ActionButton({
    onClick,
    disabled,
    loading,
    variant = "outline",
    className = "",
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "outline" | "danger";
    className?: string;
    children: ReactNode;
}) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:cursor-not-allowed disabled:opacity-50";
    const styles: Record<string, string> = {
        primary:
            "bg-joy-grass text-white shadow-[0_3px_0_var(--joy-grass-deep)] hover:brightness-105 active:translate-y-[2px]",
        outline:
            "border-2 border-joy-ink/12 bg-white text-joy-ink hover:border-joy-grass/50",
        danger: "border-2 border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${styles[variant]} ${className}`}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
        </button>
    );
}

/** Inline-edit text field: label (+ optional icon), input with a pencil/discard
 *  toggle, and a validation message. Preserves the original per-field edit UX. */
function EditableField({
    id,
    label,
    icon,
    value,
    placeholder,
    editing,
    saving,
    error,
    className = "",
    onChange,
    onToggleEdit,
    onDiscard,
}: {
    id: string;
    label: string;
    icon?: ReactNode;
    value: string;
    placeholder?: string;
    editing: boolean;
    saving: boolean;
    error?: string;
    className?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onToggleEdit: () => void;
    onDiscard: () => void;
}) {
    return (
        <div className={className}>
            <Label
                htmlFor={id}
                className="flex items-center gap-2 text-sm font-semibold text-joy-ink"
            >
                {icon}
                {label}
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
                <Input
                    id={id}
                    name={id}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={!editing || saving}
                    className="bg-white"
                />
                <button
                    type="button"
                    onClick={editing ? onDiscard : onToggleEdit}
                    disabled={saving}
                    aria-label={editing ? `Discard ${label}` : `Edit ${label}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-joy-ink/12 bg-white text-joy-ink-muted transition hover:border-joy-grass/50 hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:opacity-50"
                >
                    {editing ? (
                        <X className="h-4 w-4" />
                    ) : (
                        <PencilLine className="h-4 w-4" />
                    )}
                </button>
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}

/** Small joy tint chip. */
function JoyChip({
    children,
    className = "",
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
        >
            {children}
        </span>
    );
}

/** Completeness checklist items — labels + which `profileScore.completed` key
 *  drives each dot. Rendered data-driven so all 14 signals stay in one place. */
const COMPLETENESS_FIELDS: { key: keyof ProfileCompletion; label: string }[] = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "school", label: "School" },
    { key: "program", label: "Program" },
    { key: "graduationYear", label: "Graduation Year" },
    { key: "location", label: "Location" },
    { key: "githubUsername", label: "GitHub Username" },
    { key: "github", label: "GitHub Profile" },
    { key: "devpostUsername", label: "Devpost Username" },
    { key: "devpost", label: "Devpost Profile" },
    { key: "linkedinUrl", label: "LinkedIn" },
    { key: "portfolioUrl", label: "Portfolio" },
    { key: "resume", label: "Resume" },
    { key: "skills", label: "Skills" },
];

/** Blank profile state — also what we hard-reset to when the session's uid changes. */
const emptyStudent = (): StudentProps =>
    ({
        id: "",
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        location: "",
        school: "",
        program: "",
        graduationYear: "",
        linkedinUrl: "",
        portfolioUrl: "",
        devpostUsername: "",
        githubUsername: "",
        skills: [],
        resume: {
            id: "",
            name: "",
            url: "",
            uploadedAt: { _seconds: 0, _nanoseconds: 0 },
        },
        appliedJobs: [],
        organizations: [],
    } as StudentProps);

export default function AccountPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const profileUserId = searchParams.get("userId")?.trim() || "";

    const [student, setStudent] = useState<StudentProps>(emptyStudent);

    const [originalStudent, setOriginalStudent] = useState<StudentProps | null>(
        null
    );
    const [hasChanges, setHasChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // De-tabbed layout (Slice 2): the page is now one calm vertical scroll.
    // The onboarding card and resume quick-start deep-link by smooth-scrolling
    // to a section anchor instead of switching a tab.
    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [isUploadingResume, setIsUploadingResume] = useState(false);
    const [isDeletingResume, setIsDeletingResume] = useState(false);

    const [skillsArray, setSkillsArray] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState("");

    /* -------------------- uid-drift guard -------------------- *
     * Everything on this page is loaded for ONE uid. If the signed-in user
     * changes mid-session (a provider-link popup, a magic link completed in
     * another tab, a sign-out), the state in memory belongs to the previous
     * account — and saving it would write one account's fields, including its
     * email, onto the other account's profile doc. So we track the live uid,
     * hard-discard state whenever it changes, and refuse to PATCH with a token
     * that doesn't match the uid the state was loaded for.
     * ---------------------------------------------------------- */
    const [authUid, setAuthUid] = useState<string | null>(
        () => studentAuth.currentUser?.uid ?? null
    );
    /** The uid the currently-held `student` state was loaded for. */
    const loadedForUidRef = useRef<string | null>(null);

    useEffect(() => {
        return onIdTokenChanged(studentAuth, (user) => {
            setAuthUid(user?.uid ?? null);
        });
    }, []);

    /**
     * Guard every profile write: the state we are about to send must have been
     * loaded for the uid whose token will sign the request.
     */
    const assertSameSession = () => {
        const liveUid = studentAuth.currentUser?.uid ?? null;
        if (!liveUid || liveUid !== loadedForUidRef.current) {
            throw new Error(
                "Your session changed. Reload the page before saving so you don't write to the wrong account."
            );
        }
    };

    // Track which fields are being edited
    const [isEditing, setIsEditing] = useState({
        firstName: false,
        lastName: false,
        phone: false,
        location: false,
        school: false,
        program: false,
        graduationYear: false,
        linkedinUrl: false,
        portfolioUrl: false,
        devpostUsername: false,
        githubUsername: false,
    });

    // Validation errors
    const [validationErrors, setValidationErrors] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        location: "",
        school: "",
        program: "",
        graduationYear: "",
        linkedinUrl: "",
        portfolioUrl: "",
    });

    const [isLoadingDevpost, setIsLoadingDevpost] = useState(false);
    const [devpostError, setDevpostError] = useState<string | null>(null);

    const [isLoadingGithub, setIsLoadingGithub] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);
    const [participation, setParticipation] = useState<ParticipationItem[]>([]);
    const [wins, setWins] = useState<WinItem[]>([]);
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);

    // Profile completeness now lives in `src/lib/profile.ts` so the account
    // page, the ambient profile menu, and `useProfileSummary` score identically.

    // One-time guard so the browser-language default is attempted at most once
    // per mount and can NEVER overwrite a language the user has already saved.
    const attemptedLanguageDefault = useRef(false);

    // Load student data — keyed on the live uid, so a mid-session account change
    // discards the previous account's state and reloads from scratch.
    useEffect(() => {
        const previousUid = loadedForUidRef.current;
        if (previousUid && previousUid !== authUid) {
            // Hard discard. Unsaved edits belong to the previous account and must
            // never be carried into the new session.
            loadedForUidRef.current = null;
            setStudent(emptyStudent());
            setOriginalStudent(null);
            setHasChanges(false);
            setSkillsArray([]);
            attemptedLanguageDefault.current = false;
            if (authUid) {
                // A different account is now signed in (as opposed to a plain
                // sign-out, where PrivateRoute takes over).
                toast.error("Signed-in account changed", {
                    description:
                        "Your unsaved profile edits were discarded so they aren't written to the wrong account.",
                });
            }
        }

        if (!authUid) {
            setIsLoading(false);
            return;
        }

        const loadStudent = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.getStudent();
                // The session may have changed while the request was in flight.
                if (studentAuth.currentUser?.uid !== authUid) return;
                loadedForUidRef.current = authUid;
                setStudent(data);
                setOriginalStudent(data);
                maybeSeedBrowserLanguage(data);
            } catch (error) {
                toast.error("Failed to load profile");
            } finally {
                setIsLoading(false);
            }
        };

        // Browser-language default on first load (spec 08 §5). If the loaded
        // profile has NO `preferredLanguage` yet, detect it from the browser and
        // persist it silently. Guarded so it fires once and only when the field
        // is truly unset — a user's saved choice ("en"/"fr") is never touched.
        const maybeSeedBrowserLanguage = (data: StudentProps | null) => {
            if (attemptedLanguageDefault.current) return;
            if (!data || (data as StudentProps).preferredLanguage) return;
            attemptedLanguageDefault.current = true;

            const langs =
                (typeof navigator !== "undefined" &&
                    (navigator.languages?.length
                        ? navigator.languages
                        : navigator.language
                        ? [navigator.language]
                        : [])) ||
                [];
            const detected = langs.some((l) =>
                l?.toLowerCase().startsWith("fr")
            )
                ? "fr"
                : "en";

            updateProfileFields({ preferredLanguage: detected })
                .then(() => {
                    setStudent((prev) => ({
                        ...prev,
                        preferredLanguage: detected,
                    }));
                    setOriginalStudent((prev) =>
                        prev ? { ...prev, preferredLanguage: detected } : prev
                    );
                })
                .catch(() => {
                    // Silent — a failed default just means we retry next mount.
                    attemptedLanguageDefault.current = false;
                });
        };

        loadStudent();
    }, [authUid]);

    useEffect(() => {
        const loadActivity = async () => {
            setIsLoadingActivity(true);
            try {
                const query = profileUserId
                    ? `/profile/activity?userId=${encodeURIComponent(profileUserId)}`
                    : "/profile/activity";
                const response = await apiFetch(query);
                if (!response.ok) {
                    throw new Error("Failed to load profile activity");
                }

                const data = await response.json();

                const mapEventsWithImages = async <T extends { event: ActivityEvent }>(
                    items: T[]
                ): Promise<T[]> => {
                    return Promise.all(
                        items.map(async (item) => {
                            const heroImagePath = item.event.heroImage;
                            if (!heroImagePath) {
                                return {
                                    ...item,
                                    event: {
                                        ...item.event,
                                        heroImageUrl: null,
                                    },
                                };
                            }

                            try {
                                const heroImageUrl = await getFileUrl(heroImagePath);
                                return {
                                    ...item,
                                    event: {
                                        ...item.event,
                                        heroImageUrl,
                                    },
                                };
                            } catch {
                                return {
                                    ...item,
                                    event: {
                                        ...item.event,
                                        heroImageUrl: null,
                                    },
                                };
                            }
                        })
                    );
                };

                const fetchedParticipation = Array.isArray(data.participation)
                    ? await mapEventsWithImages<ParticipationItem>(
                          data.participation
                      )
                    : [];
                const fetchedWins = Array.isArray(data.wins)
                    ? await mapEventsWithImages<WinItem>(data.wins)
                    : [];

                setParticipation(fetchedParticipation);
                setWins(fetchedWins);
            } catch (error) {
                console.error("Error loading profile activity:", error);
                setParticipation([]);
                setWins([]);
            } finally {
                setIsLoadingActivity(false);
            }
        };

        loadActivity();
    }, [profileUserId]);

    // Calculate profile completeness dynamically whenever student data changes
    const profileScore = useMemo(() => {
        return calculateProfileScore(student);
    }, [
        student.firstName,
        student.lastName,
        student.school,
        student.program,
        student.graduationYear,
        student.location,
        student.githubUsername,
        student.github,
        student.devpostUsername,
        student.devpost,
        student.resume,
        student.skills,
        student.linkedinUrl,
        student.portfolioUrl,
    ]);

    // Parse skills array
    useEffect(() => {
        if (student.skills && student.skills.length > 0) {
            const skills = student.skills.flatMap((skill) =>
                skill
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
            );
            setSkillsArray(skills);
        } else {
            setSkillsArray([]);
        }
    }, [student.skills]);

    // Check for changes
    useEffect(() => {
        if (!originalStudent) return;

        const arraysEqual = (a: string[], b: string[]) => {
            const arrA = Array.isArray(a) ? a : [];
            const arrB = Array.isArray(b) ? b : [];
            if (arrA.length !== arrB.length) return false;
            return arrA.every((val, idx) => val === arrB[idx]);
        };

        const changed =
            student.firstName !== originalStudent.firstName ||
            student.lastName !== originalStudent.lastName ||
            student.phone !== originalStudent.phone ||
            student.location !== originalStudent.location ||
            student.school !== originalStudent.school ||
            student.program !== originalStudent.program ||
            student.graduationYear !== originalStudent.graduationYear ||
            student.linkedinUrl !== originalStudent.linkedinUrl ||
            student.portfolioUrl !== originalStudent.portfolioUrl ||
            student.devpostUsername !== originalStudent.devpostUsername ||
            student.githubUsername !== originalStudent.githubUsername ||
            !arraysEqual(student.skills, originalStudent.skills);

        setHasChanges(changed);
    }, [student, originalStudent]);

    const validateField = (name: string, value: string): string => {
        const currentYear = new Date().getFullYear();

        switch (name) {
            case "firstName":
            case "lastName":
                if (!value.trim())
                    return `${
                        name === "firstName" ? "First" : "Last"
                    } name is required`;
                if (!/^[a-zA-Z\s'-]+$/.test(value))
                    return "Only letters, spaces, hyphens, and apostrophes allowed";
                return "";

            case "phone":
                if (!value.trim()) return "Phone number is required";
                if (!/^[+\d\s()\-]+$/.test(value))
                    return "Invalid phone number format";
                return "";

            case "location":
                if (!value.trim()) return "Location is required";
                return "";

            case "school":
                if (!value.trim()) return "University/College is required";
                return "";

            case "program":
                if (!value.trim()) return "Major/Program is required";
                return "";

            case "graduationYear":
                if (!value.trim()) return "Graduation year is required";
                if (!/^\d{4}$/.test(value)) return "Must be a 4-digit year";
                const year = parseInt(value);
                if (year < currentYear - 50 || year > currentYear + 5) {
                    return `Must be between ${currentYear - 50} and ${
                        currentYear + 5
                    }`;
                }
                return "";

            case "linkedinUrl":
                if (!value.trim()) return ""; // Optional field
                try {
                    const url = new URL(value);
                    if (!url.protocol.match(/^https?:/)) {
                        return "URL must start with http:// or https://";
                    }
                    if (!url.hostname.includes("linkedin.com")) {
                        return "Must be a valid LinkedIn URL";
                    }
                } catch {
                    return "Invalid URL format";
                }
                return "";

            case "portfolioUrl":
                if (!value.trim()) return ""; // Optional field
                try {
                    const url = new URL(value);
                    if (!url.protocol.match(/^https?:/)) {
                        return "URL must start with http:// or https://";
                    }
                } catch {
                    return "Invalid URL format";
                }
                return "";

            default:
                return "";
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setStudent((prev) => ({ ...prev, [name]: value }));

        // Validate fields that require validation
        const requiredFields = [
            "firstName",
            "lastName",
            "phone",
            "location",
            "school",
            "program",
            "graduationYear",
            "linkedinUrl",
            "portfolioUrl",
        ];

        if (requiredFields.includes(name)) {
            const error = validateField(name, value);
            setValidationErrors((prev) => ({ ...prev, [name]: error }));
        }
    };

    const handleToggleEdit = (field: keyof typeof isEditing) => {
        setIsEditing((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const handleDiscardField = (field: keyof typeof isEditing) => {
        if (originalStudent) {
            setStudent((prev) => ({
                ...prev,
                [field]: (originalStudent as any)[field],
            }));
            setIsEditing((prev) => ({ ...prev, [field]: false }));
            // Clear validation error for this field
            setValidationErrors((prev) => ({ ...prev, [field]: "" }));
        }
    };

    const handleSaveChanges = async () => {
        // Only validate required fields that have been changed
        const requiredFields = [
            "firstName",
            "lastName",
            "phone",
            "location",
            "school",
            "program",
            "graduationYear",
        ];

        // Also validate optional URL fields if they have values
        const optionalUrlFields = ["linkedinUrl", "portfolioUrl"];

        const errors: any = {};
        let hasErrors = false;

        // Only validate fields that were modified
        requiredFields.forEach((field) => {
            const currentValue = (student as any)[field] || "";
            const originalValue = (originalStudent as any)?.[field] || "";

            // Only validate if the field was changed
            if (currentValue !== originalValue) {
                const error = validateField(field, currentValue);
                if (error) {
                    errors[field] = error;
                    hasErrors = true;
                }
            }
        });

        // Validate optional URL fields if they have values (changed or not)
        optionalUrlFields.forEach((field) => {
            const value = (student as any)[field] || "";
            if (value.trim()) {
                const error = validateField(field, value);
                if (error) {
                    errors[field] = error;
                    hasErrors = true;
                }
            }
        });

        if (hasErrors) {
            setValidationErrors((prev) => ({ ...prev, ...errors }));
            toast.error("Please fix all validation errors before saving");
            return;
        }

        setIsSaving(true);
        try {
            assertSameSession();

            const preSaveCompleted = originalStudent
                ? calculateProfileScore(originalStudent).completed
                : null;

            await apiService.updateStudent(student);

            if (preSaveCompleted) {
                const postSaveCompleted = calculateProfileScore(student).completed;
                const newlyCompletedFields = (
                    Object.keys(postSaveCompleted) as (keyof ProfileCompletion)[]
                ).filter(
                    (field) =>
                        postSaveCompleted[field] && !preSaveCompleted[field]
                );

                if (newlyCompletedFields.length > 0) {
                    trackEvent("profile_completed_section", {
                        section: newlyCompletedFields.join(","),
                    });
                }
            }

            setOriginalStudent(student);
            setHasChanges(false);
            // Clear any validation errors after successful save
            setValidationErrors({
                firstName: "",
                lastName: "",
                phone: "",
                location: "",
                school: "",
                program: "",
                graduationYear: "",
                linkedinUrl: "",
                portfolioUrl: "",
            });
            // Reset all editing states
            setIsEditing({
                firstName: false,
                lastName: false,
                phone: false,
                location: false,
                school: false,
                program: false,
                graduationYear: false,
                linkedinUrl: false,
                portfolioUrl: false,
                devpostUsername: false,
                githubUsername: false,
            });
            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error("Failed to save changes", {
                description:
                    error instanceof Error ? error.message : undefined,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelChanges = () => {
        if (originalStudent) {
            setStudent(originalStudent);
            setHasChanges(false);
        }
    };

    // Apply a partial patch that a structured-builder section (Experience,
    // Education, Projects, Work Authorization, structured Skills — spec 08 §3.1)
    // has ALREADY persisted through its own `PATCH /profile/update`. We sync both
    // `student` and `originalStudent` so the header "Save Changes" affordance does
    // not appear for work that is already saved, and so the onboarding card and
    // the rest of the page re-derive from the new values immediately.
    const applyProfilePatch = (patch: Partial<StudentProps>) => {
        setStudent((prev) => ({ ...prev, ...patch }));
        setOriginalStudent((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const prepared = prepareResumeFile(file);
        if ("error" in prepared) {
            toast.error(prepared.error);
            e.target.value = "";
            return;
        }

        setResumeFile(prepared.file);
    };

    // Shared with the one-click quick-start pipeline (ResumeQuickStart) via
    // `uploadResume()` in `@/lib/resume-parse`.
    const handleResumeUpload = async () => {
        if (!resumeFile) return;

        setIsUploadingResume(true);
        try {
            await uploadResume(resumeFile);

            toast.success("Resume uploaded successfully!");
            setResumeFile(null);
            const input = document.getElementById("resume") as HTMLInputElement;
            if (input) input.value = "";
        } catch (error) {
            toast.error("Failed to upload resume");
        } finally {
            setIsUploadingResume(false);
        }
    };

    // Re-fetches the full student/profile state after a resume upload —
    // shared by the manual "Skills & Resume" Upload button and the
    // ResumeQuickStart one-click pipeline.
    const refreshStudent = async () => {
        const updatedStudent = await apiService.getStudent();
        setStudent(updatedStudent as any);
        setOriginalStudent(updatedStudent as any);
    };

    const handleDeleteResume = async () => {
        if (!student.resume?.id) return;

        // Confirm deletion
        const confirmed = window.confirm(
            "Are you sure you want to delete your resume? This action cannot be undone."
        );

        if (!confirmed) return;

        setIsDeletingResume(true);
        try {
            const response = await apiFetch("/profile/main-resume", {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Delete failed");

            // Update local state to remove resume
            const updatedStudent = {
                ...student,
                resume: {
                    id: "",
                    name: "",
                    url: "",
                    uploadedAt: { _seconds: 0, _nanoseconds: 0 },
                },
            };
            setStudent(updatedStudent as StudentProps);
            setOriginalStudent(updatedStudent as StudentProps);

            toast.success("Resume deleted successfully!");
        } catch (error) {
            toast.error("Failed to delete resume");
        } finally {
            setIsDeletingResume(false);
        }
    };

    const handleAddSkill = () => {
        if (!newSkill.trim()) {
            toast.error("Please enter a skill");
            return;
        }

        const newSkills = newSkill
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        if (skillsArray.length + newSkills.length > 15) {
            toast.error("Maximum 15 skills allowed");
            return;
        }

        const updatedSkills = [...skillsArray, ...newSkills];
        setSkillsArray(updatedSkills);
        setStudent((prev) => ({ ...prev, skills: updatedSkills }));
        setNewSkill("");
        toast.success(`Added ${newSkills.length} skill(s)`);
    };

    const handleRemoveSkill = (indexToRemove: number) => {
        const updatedSkills = skillsArray.filter(
            (_, index) => index !== indexToRemove
        );
        setSkillsArray(updatedSkills);
        setStudent((prev) => ({ ...prev, skills: updatedSkills }));
        toast.success("Skill removed");
    };

    const connectGithub = async () => {
        setIsLoadingGithub(true);
        setGithubError(null);

        try {
            // Ensure we have a session before attempting GitHub auth
            if (!studentAuth.currentUser) {
                await initializeStudentSession();
            }

            if (!studentAuth.currentUser)
                throw new Error("User not authenticated");

            // Binds/verifies the CURRENT user only — see src/lib/github-link.ts.
            // A GitHub identity owned by another account throws a user-facing
            // error instead of silently switching the signed-in account.
            const token = await connectGithubForUser(studentAuth.currentUser);

            if (token) {
                const profileData = await fetchGithubUserProfile(token);

                // Update student state with the verified profile
                setStudent((prev) => {
                    const updated = {
                        ...prev,
                        githubUsername: profileData.username,
                        github: profileData,
                    };
                    return updated;
                });

                // Also update original student to reflect saved state
                // This prevents "Save Changes" from showing since the profile is already saved to backend
                setOriginalStudent((prev) =>
                    prev
                        ? {
                              ...prev,
                              githubUsername: profileData.username,
                              github: profileData,
                          }
                        : null
                );

                toast.success("GitHub profile connected and saved!", {
                    description: `Connected ${profileData.username} with ${profileData.repoCount} repositories`,
                });
            } else {
                throw new Error("Failed to get GitHub token");
            }
        } catch (error) {
            // `connectGithubForUser` throws already-user-facing messages for the
            // "owned by another account" / "wrong GitHub account" cases; anything
            // else falls back to the generic copy.
            const message =
                error instanceof Error &&
                (error.message === GITHUB_ALREADY_LINKED_MESSAGE ||
                    error.message === GITHUB_USER_MISMATCH_MESSAGE)
                    ? error.message
                    : "Could not connect GitHub profile. Please try again.";
            setGithubError(message);
            toast.error("Connection failed", { description: message });
            console.error(error);
        } finally {
            setIsLoadingGithub(false);
        }
    };

    const disconnectGithub = async () => {
        setIsLoadingGithub(true);
        try {
            assertSameSession();

            // Clear GitHub data from state
            const updatedStudent = {
                ...student,
                githubUsername: "",
                github: null,
            };

            setStudent(updatedStudent);

            // Save to backend
            await apiService.updateStudent(updatedStudent);

            // Update original state
            setOriginalStudent(updatedStudent);

            toast.success("GitHub disconnected successfully!");
        } catch (error) {
            toast.error("Failed to disconnect GitHub", {
                description:
                    error instanceof Error ? error.message : undefined,
            });
        } finally {
            setIsLoadingGithub(false);
        }
    };

    const fetchDevpostProfile = async () => {
        if (!student.devpostUsername) {
            toast.error("Please enter a Devpost username first");
            return;
        }

        setIsLoadingDevpost(true);
        setDevpostError(null);

        try {
            const response = await apiFetch(`/devpost/profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: student.devpostUsername }),
            });

            if (!response.ok)
                throw new Error("Failed to fetch Devpost profile");

            const responseData = await response.json();
            if (!responseData.success) {
                throw new Error(
                    responseData.error || "Failed to fetch Devpost profile"
                );
            }

            setStudent((prev) => ({
                ...prev,
                devpost: responseData.data,
                devpostUsername: responseData.data.username,
            }));

            setOriginalStudent((prev) =>
                prev
                    ? {
                          ...prev,
                          devpost: responseData.data,
                          devpostUsername: responseData.data.username,
                      }
                    : null
            );

            toast.success("Devpost profile verified and saved!");
        } catch (error) {
            setDevpostError(
                "Could not load Devpost profile. Please check the username and try again."
            );
            toast.error("Verification failed");
        } finally {
            setIsLoadingDevpost(false);
        }
    };

    const removeDevpostConnection = async () => {
        setIsLoadingDevpost(true);
        try {
            assertSameSession();

            // Clear Devpost data from state
            const updatedStudent = {
                ...student,
                devpostUsername: "",
                devpost: null,
            };

            setStudent(updatedStudent);

            // Save to backend
            await apiService.updateStudent(updatedStudent);

            // Update original state
            setOriginalStudent(updatedStudent);

            toast.success("Devpost connection removed successfully!");
        } catch (error) {
            toast.error("Failed to remove Devpost connection", {
                description:
                    error instanceof Error ? error.message : undefined,
            });
        } finally {
            setIsLoadingDevpost(false);
        }
    };

    const truncateText = (text: string | undefined, maxLength: number): string => {
        if (!text) {
            return "";
        }

        return text.length > maxLength
            ? `${text.slice(0, maxLength).trimEnd()}...`
            : text;
    };

    const buildEventHref = (event: ActivityEvent): string => {
        return `/events/${event.slug || event.id}`;
    };

    if (isLoading) {
        return (
            <div style={{ colorScheme: "light" }}>
                <Seo
                    title="Your profile"
                    description="Edit your Tailed profile, resume, and connected accounts."
                />
                <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false}>
                    <div className="mx-auto max-w-3xl space-y-6 px-5 pb-16 pt-10 md:pt-12">
                        <div className="h-40 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                        <div className="h-64 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                    </div>
                </PlaygroundShell>
            </div>
        );
    }

    const completedCount = profileScore
        ? Object.values(profileScore.completed).filter(Boolean).length
        : 0;
    const totalCount = profileScore
        ? Object.keys(profileScore.completed).length
        : 0;

    return (
        <div style={{ colorScheme: "light" }}>
            <Seo
                title="Your profile"
                description="Edit your Tailed profile, resume, and connected accounts."
            />
            <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false}>
                <div className="mx-auto max-w-3xl space-y-8 px-5 pb-16 pt-10 md:pt-12">
                    {/* Header card — identity + completeness, pinned at the top. */}
                    <JoyCard>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                            <img
                                src={
                                    student?.github?.avatarUrl ||
                                    "https://www.placeholderimage.online/images/generic/users-profile.jpg"
                                }
                                alt="Profile"
                                className="h-20 w-20 shrink-0 rounded-full border-4 border-joy-grass/15 object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <h1 className="joy-display text-2xl font-extrabold leading-tight text-joy-ink sm:text-3xl">
                                    {student.firstName} {student.lastName}
                                </h1>
                                <p className="mt-1 text-sm text-joy-ink-muted">
                                    {student.email}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <JoyChip className="bg-joy-grass/10 text-joy-grass">
                                        {student.school || "Not specified"}
                                    </JoyChip>
                                    <JoyChip className="bg-joy-sky/12 text-joy-sky-ink">
                                        {student.program || "Not specified"}
                                    </JoyChip>
                                </div>
                            </div>
                            {hasChanges && (
                                <div className="flex shrink-0 items-center gap-2">
                                    <PlaygroundButton
                                        variant="outline"
                                        onClick={handleCancelChanges}
                                    >
                                        Cancel
                                    </PlaygroundButton>
                                    <PlaygroundButton onClick={handleSaveChanges}>
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            "Save changes"
                                        )}
                                    </PlaygroundButton>
                                </div>
                            )}
                        </div>

                        {/* Profile completeness */}
                        {profileScore && (
                            <div className="mt-6 rounded-xl border border-joy-ink/8 bg-joy-surface p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="joy-display text-lg font-extrabold text-joy-ink">
                                            Profile completeness: {profileScore.score}%
                                        </h3>
                                        <p className="mt-1 text-sm text-joy-ink-muted">
                                            Students with complete profiles have{" "}
                                            <span className="font-bold text-joy-grass">
                                                83% higher chance
                                            </span>{" "}
                                            of getting hired!
                                        </p>
                                    </div>
                                    {profileScore.score === 100 && (
                                        <JoyChip className="bg-joy-grass text-white">
                                            Completed
                                        </JoyChip>
                                    )}
                                </div>
                                <div className="mb-4 flex gap-1.5">
                                    {Array.from({ length: totalCount }).map(
                                        (_, index) => (
                                            <div
                                                key={index}
                                                className={`h-2 flex-1 rounded-sm transition-all duration-300 ${
                                                    index < completedCount
                                                        ? "bg-joy-grass"
                                                        : "bg-joy-ink/10"
                                                }`}
                                            />
                                        )
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                    {COMPLETENESS_FIELDS.map((field) => {
                                        const done =
                                            !!profileScore.completed[
                                                field.key
                                            ];
                                        return (
                                            <div
                                                key={field.key}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                {done ? (
                                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-joy-grass" />
                                                ) : (
                                                    <Circle className="h-4 w-4 shrink-0 text-joy-ink/30" />
                                                )}
                                                <span
                                                    className={
                                                        done
                                                            ? "text-joy-ink"
                                                            : "text-joy-ink-muted"
                                                    }
                                                >
                                                    {field.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </JoyCard>

                    {/* Onboarding CTA — curated first steps for soft accounts. Reads
                        real signals off the profile; hides itself once every item is
                        done (or the card is dismissed). See spec 08 §3.0. The tab
                        CTA now smooth-scrolls to a section anchor. */}
                    <AccountOnboardingCard
                        profile={student}
                        onGoToTab={scrollToSection}
                    />

                    {/* ---- Identity & contact ---- */}
                    <Section
                        id="identity"
                        icon={<User className="h-5 w-5" />}
                        title="Identity & contact"
                        description="Who you are and how we reach you."
                    >
                        <JoyCard>
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <EditableField
                                    id="firstName"
                                    label="First Name"
                                    value={student.firstName || ""}
                                    placeholder="First Name"
                                    editing={isEditing.firstName}
                                    saving={isSaving}
                                    error={validationErrors.firstName}
                                    onChange={handleInputChange}
                                    onToggleEdit={() => handleToggleEdit("firstName")}
                                    onDiscard={() => handleDiscardField("firstName")}
                                />
                                <EditableField
                                    id="lastName"
                                    label="Last Name"
                                    value={student.lastName || ""}
                                    placeholder="Last Name"
                                    editing={isEditing.lastName}
                                    saving={isSaving}
                                    error={validationErrors.lastName}
                                    onChange={handleInputChange}
                                    onToggleEdit={() => handleToggleEdit("lastName")}
                                    onDiscard={() => handleDiscardField("lastName")}
                                />
                                <div>
                                    <Label
                                        htmlFor="email"
                                        className="text-sm font-semibold text-joy-ink"
                                    >
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        value={student.email}
                                        disabled
                                        className="mt-1.5 bg-white"
                                    />
                                </div>
                                <EditableField
                                    id="phone"
                                    label="Phone Number"
                                    value={student.phone || ""}
                                    placeholder="+1 (555) 000-0000"
                                    editing={isEditing.phone}
                                    saving={isSaving}
                                    error={validationErrors.phone}
                                    onChange={handleInputChange}
                                    onToggleEdit={() => handleToggleEdit("phone")}
                                    onDiscard={() => handleDiscardField("phone")}
                                />
                                <EditableField
                                    id="location"
                                    label="Location"
                                    value={student.location || ""}
                                    placeholder="City, Country"
                                    editing={isEditing.location}
                                    saving={isSaving}
                                    error={validationErrors.location}
                                    className="md:col-span-2"
                                    onChange={handleInputChange}
                                    onToggleEdit={() => handleToggleEdit("location")}
                                    onDiscard={() => handleDiscardField("location")}
                                />
                            </div>
                            {/* Communication-language preference (spec 08 §5).
                                Drives the language of emails + surveys only; does
                                NOT switch the platform UI locale. */}
                            <LanguagePreference
                                preferredLanguage={student.preferredLanguage}
                                onSaved={applyProfilePatch}
                            />
                        </JoyCard>
                        {/* Work authorization — job-relevant, NOT anonymous; kept
                            clearly separate from the demographic self-ID survey
                            (spec 08 §4.5). */}
                        <WorkAuthorizationEditor
                            workAuthorization={student.workAuthorization}
                            onSaved={applyProfilePatch}
                        />
                    </Section>

                    {/* ---- Education & experience ---- */}
                    <Section
                        id="education"
                        icon={<GraduationCap className="h-5 w-5" />}
                        title="Education & experience"
                        description="Your CV: schools, roles, and projects."
                    >
                        {/* Resume-drop fast start (spec 08 Open-Q1): one click or
                            drag-and-drop uploads AND parses the resume, then opens
                            the review dialog — no scroll-jump to the Skills &
                            resume section required. */}
                        <ResumeQuickStart
                            hasResume={!!student.resume?.name}
                            profile={student}
                            onUploaded={refreshStudent}
                            onMerged={applyProfilePatch}
                        />
                        <JoyCard>
                            <h3 className="joy-display mb-4 text-lg font-extrabold text-joy-ink">
                                Educational background
                            </h3>
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <EditableField
                                    id="school"
                                    label="University / College"
                                    value={student.school || ""}
                                    placeholder="Harvard University"
                                    editing={isEditing.school}
                                    saving={isSaving}
                                    error={validationErrors.school}
                                    className="md:col-span-2"
                                    onChange={handleInputChange}
                                    onToggleEdit={() => handleToggleEdit("school")}
                                    onDiscard={() => handleDiscardField("school")}
                                />
                                <EditableField
                                    id="program"
                                    label="Major / Program"
                                    value={student.program || ""}
                                    placeholder="Computer Science"
                                    editing={isEditing.program}
                                    saving={isSaving}
                                    error={validationErrors.program}
                                    onChange={handleInputChange}
                                    onToggleEdit={() => handleToggleEdit("program")}
                                    onDiscard={() => handleDiscardField("program")}
                                />
                                <EditableField
                                    id="graduationYear"
                                    label="Graduation Year"
                                    value={student.graduationYear || ""}
                                    placeholder="2025"
                                    editing={isEditing.graduationYear}
                                    saving={isSaving}
                                    error={validationErrors.graduationYear}
                                    onChange={handleInputChange}
                                    onToggleEdit={() =>
                                        handleToggleEdit("graduationYear")
                                    }
                                    onDiscard={() =>
                                        handleDiscardField("graduationYear")
                                    }
                                />
                            </div>
                        </JoyCard>

                        {/* Structured builder: additional education, experience,
                            projects (spec 08 §4.2–4.3). Each editor self-persists
                            via the shared PATCH /profile/update path and syncs local
                            state through applyProfilePatch. The Education editor
                            keeps its first entry mirrored to the flat
                            school/program/gradYear scalars above (backend re-mirrors
                            on every write). */}
                        <EducationEditor
                            profile={student}
                            onSaved={applyProfilePatch}
                        />
                        <ExperienceEditor
                            experiences={student.experiences}
                            onSaved={applyProfilePatch}
                        />
                        <ProjectsEditor
                            projects={student.projects}
                            onSaved={applyProfilePatch}
                        />
                    </Section>

                    {/* ---- Professional ---- */}
                    <Section
                        id="professional"
                        icon={<Code className="h-5 w-5" />}
                        title="Professional"
                        description="Links and connected developer profiles."
                    >
                        {/* LinkedIn & Portfolio */}
                        <JoyCard>
                            <h3 className="joy-display mb-4 text-lg font-extrabold text-joy-ink">
                                Professional links
                            </h3>
                            <div className="space-y-4">
                                <EditableField
                                    id="linkedinUrl"
                                    label="LinkedIn Profile URL"
                                    icon={
                                        <Linkedin className="h-4 w-4 text-joy-sky-ink" />
                                    }
                                    value={student.linkedinUrl || ""}
                                    placeholder="https://linkedin.com/in/username"
                                    editing={isEditing.linkedinUrl}
                                    saving={isSaving}
                                    error={validationErrors.linkedinUrl}
                                    onChange={handleInputChange}
                                    onToggleEdit={() =>
                                        handleToggleEdit("linkedinUrl")
                                    }
                                    onDiscard={() =>
                                        handleDiscardField("linkedinUrl")
                                    }
                                />
                                <EditableField
                                    id="portfolioUrl"
                                    label="Portfolio Website"
                                    icon={<Globe className="h-4 w-4 text-joy-grass" />}
                                    value={student.portfolioUrl || ""}
                                    placeholder="https://yourwebsite.com"
                                    editing={isEditing.portfolioUrl}
                                    saving={isSaving}
                                    error={validationErrors.portfolioUrl}
                                    onChange={handleInputChange}
                                    onToggleEdit={() =>
                                        handleToggleEdit("portfolioUrl")
                                    }
                                    onDiscard={() =>
                                        handleDiscardField("portfolioUrl")
                                    }
                                />
                            </div>
                        </JoyCard>

                        {/* GitHub */}
                        <JoyCard>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="joy-display flex items-center gap-2 text-lg font-extrabold text-joy-ink">
                                    <Github className="h-5 w-5" />
                                    GitHub
                                </h3>
                                {student.github ? (
                                    <ActionButton
                                        onClick={disconnectGithub}
                                        variant="danger"
                                        loading={isLoadingGithub}
                                        disabled={isLoadingGithub || isSaving}
                                    >
                                        Disconnect
                                    </ActionButton>
                                ) : (
                                    <ActionButton
                                        onClick={connectGithub}
                                        loading={isLoadingGithub}
                                        disabled={isLoadingGithub || isSaving}
                                    >
                                        Connect GitHub
                                    </ActionButton>
                                )}
                            </div>
                            <div>
                                <Label
                                    htmlFor="githubUsername"
                                    className="text-sm font-semibold text-joy-ink"
                                >
                                    GitHub Username
                                </Label>
                                <Input
                                    id="githubUsername"
                                    name="githubUsername"
                                    value={student.githubUsername || ""}
                                    onChange={handleInputChange}
                                    placeholder="username"
                                    disabled={isSaving}
                                    className="mt-1.5 bg-white"
                                />
                                {githubError && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {githubError}
                                    </p>
                                )}
                            </div>

                            {student.github && (
                                <div className="mt-4 rounded-xl border border-joy-sky/25 bg-joy-sky/8 p-4">
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={student.github.avatarUrl}
                                            alt={student.github.username}
                                            className="h-16 w-16 rounded-full"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-joy-ink">
                                                    {student.github.name ||
                                                        student.github.username}
                                                </h4>
                                                <a
                                                    href={`https://github.com/${student.github.username}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-joy-sky-ink hover:underline"
                                                >
                                                    @{student.github.username}
                                                </a>
                                            </div>
                                            {student.github.bio && (
                                                <p className="mt-1 text-sm text-joy-ink-muted">
                                                    {student.github.bio}
                                                </p>
                                            )}
                                            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {student.github.repoCount}
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Repos
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {
                                                            student.github
                                                                .starsReceived
                                                        }
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Stars
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {student.github.followers}
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Followers
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {
                                                            student.github
                                                                .contributionCount
                                                        }
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Contributions (Past 2
                                                        years)
                                                    </p>
                                                </div>
                                            </div>
                                            {student.github.topLanguages.length >
                                                0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {student.github.topLanguages
                                                        .slice(0, 5)
                                                        .map((lang) => (
                                                            <JoyChip
                                                                key={lang}
                                                                className="bg-joy-sky/15 text-joy-sky-ink"
                                                            >
                                                                {lang}
                                                            </JoyChip>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-joy-ink-muted">
                                        ✓ Profile connected and saved
                                    </p>
                                </div>
                            )}
                        </JoyCard>

                        {/* Devpost */}
                        <JoyCard>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="joy-display text-lg font-extrabold text-joy-ink">
                                    Devpost
                                </h3>
                                {student.devpost ? (
                                    <ActionButton
                                        onClick={removeDevpostConnection}
                                        variant="danger"
                                        loading={isLoadingDevpost}
                                        disabled={isLoadingDevpost || isSaving}
                                    >
                                        Remove Connection
                                    </ActionButton>
                                ) : (
                                    <ActionButton
                                        onClick={fetchDevpostProfile}
                                        loading={isLoadingDevpost}
                                        disabled={
                                            isLoadingDevpost ||
                                            isSaving ||
                                            !student.devpostUsername
                                        }
                                    >
                                        Verify Profile
                                    </ActionButton>
                                )}
                            </div>
                            <div>
                                <Label
                                    htmlFor="devpostUsername"
                                    className="text-sm font-semibold text-joy-ink"
                                >
                                    Devpost Username
                                </Label>
                                <Input
                                    id="devpostUsername"
                                    name="devpostUsername"
                                    value={student.devpostUsername || ""}
                                    onChange={handleInputChange}
                                    placeholder="username"
                                    disabled={isSaving}
                                    className="mt-1.5 bg-white"
                                />
                                {devpostError && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {devpostError}
                                    </p>
                                )}
                            </div>

                            {student.devpost && (
                                <div className="mt-4 rounded-xl border border-joy-grass/25 bg-joy-grass/8 p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1">
                                            <h4 className="font-bold text-joy-ink">
                                                {student.devpost.name ||
                                                    student.devpost.username}
                                            </h4>
                                            <p className="text-sm text-joy-ink-muted">
                                                @{student.devpost.username}
                                            </p>
                                            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {
                                                            student.devpost.stats
                                                                .projectCount
                                                        }
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Projects
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {
                                                            student.devpost.stats
                                                                .hackathonCount
                                                        }
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Hackathons
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {
                                                            student.devpost.stats
                                                                .winCount
                                                        }
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        Wins
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-joy-ink">
                                                        {student.devpost
                                                            .achievements
                                                            ?.firstPlaceWins || 0}
                                                    </p>
                                                    <p className="text-xs text-joy-ink-muted">
                                                        1st Places
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-joy-ink-muted">
                                        ✓ Profile verified and saved
                                    </p>
                                </div>
                            )}
                        </JoyCard>
                    </Section>

                    {/* ---- Skills & resume ---- */}
                    <Section
                        id="skills"
                        icon={<FileText className="h-5 w-5" />}
                        title="Skills & resume"
                        description="Tag your strengths and keep your resume current."
                    >
                        {/* Skills */}
                        <JoyCard>
                            <h3 className="joy-display mb-4 text-lg font-extrabold text-joy-ink">
                                Skills
                            </h3>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={newSkill}
                                        onChange={(e) =>
                                            setNewSkill(e.target.value)
                                        }
                                        onKeyPress={(e) =>
                                            e.key === "Enter" && handleAddSkill()
                                        }
                                        placeholder="Add a skill (e.g., React, Python)"
                                        maxLength={50}
                                        disabled={skillsArray.length >= 15}
                                        className="bg-white"
                                    />
                                    <ActionButton
                                        onClick={handleAddSkill}
                                        variant="primary"
                                        disabled={
                                            skillsArray.length >= 15 ||
                                            !newSkill.trim()
                                        }
                                    >
                                        Add
                                    </ActionButton>
                                </div>
                                <p className="text-xs text-joy-ink-muted">
                                    {skillsArray.length >= 15
                                        ? "Maximum skills reached"
                                        : `${
                                              15 - skillsArray.length
                                          } more skill(s) can be added`}
                                </p>
                                {skillsArray.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {skillsArray.map((skill, index) => (
                                            <JoyChip
                                                key={index}
                                                className="bg-joy-grass/10 px-3 py-1.5 text-joy-grass"
                                            >
                                                {skill}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemoveSkill(index)
                                                    }
                                                    aria-label={`Remove ${skill}`}
                                                    className="ml-2 cursor-pointer hover:text-red-600"
                                                >
                                                    ×
                                                </button>
                                            </JoyChip>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-joy-ink/8 bg-joy-surface p-4 text-center">
                                        <p className="text-sm text-joy-ink-muted">
                                            No skills added yet. Add your first
                                            skill above!
                                        </p>
                                    </div>
                                )}
                            </div>
                        </JoyCard>

                        {/* Structured skills — tag with category/level while keeping
                            the flat skills list above populated (spec 08 §4.4). */}
                        <SkillsStructuredEditor
                            skillsStructured={student.skillsStructured}
                            onSaved={applyProfilePatch}
                        />

                        {/* Resume */}
                        <JoyCard>
                            <h3 className="joy-display mb-4 text-lg font-extrabold text-joy-ink">
                                Resume
                            </h3>
                            {student.resume?.name ? (
                                <div className="mb-4 flex items-center justify-between rounded-xl border border-joy-grass/25 bg-joy-grass/8 p-4">
                                    <div className="flex items-center gap-3">
                                        <Upload className="h-5 w-5 text-joy-grass" />
                                        <div>
                                            <p className="font-bold text-joy-ink">
                                                {student.resume.name}.pdf
                                            </p>
                                            <p className="text-xs text-joy-ink-muted">
                                                Uploaded{" "}
                                                {new Date(
                                                    student.resume.uploadedAt
                                                        ._seconds * 1000
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {student.resume.url && (
                                            <a
                                                href={student.resume.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-bold text-joy-grass hover:underline"
                                            >
                                                View
                                            </a>
                                        )}
                                        <ActionButton
                                            onClick={handleDeleteResume}
                                            variant="danger"
                                            loading={isDeletingResume}
                                            disabled={isDeletingResume}
                                        >
                                            Delete
                                        </ActionButton>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 rounded-xl border border-joy-ink/8 bg-joy-surface p-4">
                                    <p className="text-sm text-joy-ink-muted">
                                        No resume uploaded yet.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Input
                                    id="resume"
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleResumeChange}
                                    className="cursor-pointer bg-white"
                                />
                                <ActionButton
                                    variant="primary"
                                    disabled={!resumeFile || isUploadingResume}
                                    loading={isUploadingResume}
                                    onClick={async () => {
                                        await handleResumeUpload();
                                        await refreshStudent();
                                    }}
                                >
                                    Upload
                                </ActionButton>
                            </div>
                            {resumeFile && (
                                <p className="mt-2 text-sm text-joy-ink-muted">
                                    Ready to upload:{" "}
                                    <strong>{resumeFile.name}</strong>
                                </p>
                            )}
                        </JoyCard>
                    </Section>

                    {/* ---- Events & wins ---- */}
                    <Section
                        id="activity"
                        icon={<Trophy className="h-5 w-5" />}
                        title="Events & wins"
                        description="Where you showed up and what you took home."
                    >
                        <JoyCard>
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="joy-display text-lg font-extrabold text-joy-ink">
                                    Participation
                                </h3>
                                <JoyChip className="bg-joy-ink/6 text-joy-ink-muted">
                                    {participation.length} events
                                </JoyChip>
                            </div>

                            {isLoadingActivity ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <div
                                            key={index}
                                            className="h-56 w-full animate-pulse rounded-xl border border-joy-ink/8 bg-joy-surface"
                                        />
                                    ))}
                                </div>
                            ) : participation.length === 0 ? (
                                <p className="text-sm text-joy-ink-muted">
                                    No participation events found.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {participation.map((item, index) => (
                                        <button
                                            key={`${item.event.id}-${index}`}
                                            type="button"
                                            onClick={() =>
                                                navigate(buildEventHref(item.event))
                                            }
                                            className="overflow-hidden rounded-xl border border-joy-ink/8 bg-white text-left transition hover:border-joy-grass/40 hover:shadow-md"
                                        >
                                            {item.event.heroImageUrl ? (
                                                <img
                                                    src={item.event.heroImageUrl}
                                                    alt={item.event.title}
                                                    className="h-32 w-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-32 w-full bg-joy-surface" />
                                            )}
                                            <div className="space-y-2 p-3">
                                                <JoyChip className="bg-joy-grass/10 text-joy-grass">
                                                    Participation
                                                </JoyChip>
                                                <p className="text-sm font-bold leading-tight text-joy-ink">
                                                    {item.event.title}
                                                </p>
                                                <p className="line-clamp-3 text-xs text-joy-ink-muted">
                                                    {truncateText(
                                                        item.event.description,
                                                        140
                                                    ) || "No description provided."}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </JoyCard>

                        <JoyCard>
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="joy-display text-lg font-extrabold text-joy-ink">
                                    Wins & awards
                                </h3>
                                <JoyChip className="bg-joy-sun/25 text-joy-sun-ink">
                                    {wins.length} awards
                                </JoyChip>
                            </div>

                            {isLoadingActivity ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <div
                                            key={index}
                                            className="h-64 w-full animate-pulse rounded-xl border border-joy-ink/8 bg-joy-surface"
                                        />
                                    ))}
                                </div>
                            ) : wins.length === 0 ? (
                                <p className="text-sm text-joy-ink-muted">
                                    No wins recorded yet.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {wins.map((item, index) => {
                                        const isFirstPlace = item.award.place === 1;

                                        return (
                                            <button
                                                key={`${item.award.id}-${index}`}
                                                type="button"
                                                onClick={() =>
                                                    navigate(
                                                        buildEventHref(item.event)
                                                    )
                                                }
                                                className={`overflow-hidden rounded-xl border text-left transition hover:shadow-md ${
                                                    isFirstPlace
                                                        ? "border-joy-sun/70 bg-joy-sun/10"
                                                        : "border-joy-ink/8 bg-white hover:border-joy-grass/40"
                                                }`}
                                            >
                                                {item.event.heroImageUrl ? (
                                                    <img
                                                        src={
                                                            item.event.heroImageUrl
                                                        }
                                                        alt={item.event.title}
                                                        className="h-32 w-full object-cover"
                                                    />
                                                ) : (
                                                    <div
                                                        className={`h-32 w-full ${
                                                            isFirstPlace
                                                                ? "bg-joy-sun/25"
                                                                : "bg-joy-surface"
                                                        }`}
                                                    />
                                                )}
                                                <div className="space-y-2 p-3">
                                                    <JoyChip
                                                        className={
                                                            isFirstPlace
                                                                ? "bg-joy-sun text-joy-sun-ink"
                                                                : "bg-joy-sky/12 text-joy-sky-ink"
                                                        }
                                                    >
                                                        {isFirstPlace
                                                            ? "1st Place Award"
                                                            : item.award.place
                                                            ? `${item.award.place}${
                                                                  item.award
                                                                      .place === 2
                                                                      ? "nd"
                                                                      : item.award
                                                                            .place ===
                                                                        3
                                                                      ? "rd"
                                                                      : "th"
                                                              } Place Award`
                                                            : "Special Award"}
                                                    </JoyChip>
                                                    <p className="text-sm font-bold leading-tight text-joy-ink">
                                                        {item.award.title}
                                                    </p>
                                                    <p className="text-xs text-joy-ink">
                                                        {item.event.title}
                                                    </p>
                                                    <p className="line-clamp-3 text-xs text-joy-ink-muted">
                                                        {truncateText(
                                                            item.award
                                                                .prizeDescription ||
                                                                item.event
                                                                    .description,
                                                            140
                                                        ) ||
                                                            "No description provided."}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </JoyCard>
                    </Section>
                </div>
            </PlaygroundShell>
        </div>
    );
}

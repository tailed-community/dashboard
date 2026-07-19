import express from "express";
import Busboy from "busboy";
import crypto from "crypto";
import { db, studentAuth, storage } from "../lib/firebase";
import { logger } from "firebase-functions";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { parseResumePdf } from "../lib/resume-parser";

const router = express.Router();

/**
 * Generates a valid download URL for a document from student storage
 * Uses signed URLs in production (24h expiration) or download tokens in development
 * @param userId - Student user ID
 * @param documentId - Document ID
 * @param documentType - Type of document (resume, cover, grades)
 * @returns Download URL or original URL if generation fails
 */
async function generateDocumentUrl(
    userId: string,
    documentId: string,
    documentType: "resume" | "cover" | "grades"
): Promise<string | null> {
    if (!storage) {
        logger.error("Student storage is not initialized");
        return null;
    }

    try {
        let storagePath: string;

        switch (documentType) {
            case "resume":
                storagePath = `profiles/${userId}/resumes/main_resume/${documentId}.pdf`;
                break;
            case "cover":
                storagePath = `profiles/${userId}/documents/cover_letters/${documentId}.pdf`;
                break;
            case "grades":
                storagePath = `profiles/${userId}/documents/grades/${documentId}.pdf`;
                break;
            default:
                return null;
        }

        const file = storage.bucket().file(storagePath);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            logger.warn(`Document not found: ${storagePath}`);
            return null;
        }

        // Use different URL generation strategy based on environment
        const isProduction = process.env.NODE_ENV === "production";

        if (isProduction) {
            // Production: Use signed URLs with 24-hour expiration
            try {
                const expirationDate = new Date();
                expirationDate.setDate(expirationDate.getDate() + 1); // 24 hours from now

                const [url] = await file.getSignedUrl({
                    version: "v4",
                    action: "read",
                    expires: expirationDate,
                });

                return url;
            } catch (signError) {
                logger.error(
                    `Failed to generate signed URL, falling back to token method:`,
                    signError
                );
                // Fall through to token method if signing fails
            }
        }

        // Development: Use Firebase download tokens (works with gcloud auth)
        const [metadata] = await file.getMetadata();
        let token = metadata.metadata?.firebaseStorageDownloadTokens;

        if (!token) {
            // Generate a new token
            token = crypto.randomUUID();
            await file.setMetadata({
                metadata: {
                    firebaseStorageDownloadTokens: token,
                },
            });
        }

        // Construct public URL with token
        const bucketName = storage.bucket().name;
        const encodedPath = encodeURIComponent(storagePath);
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

        return url;
    } catch (error) {
        logger.error(`Error generating document URL for ${documentType}:`, error);
        return null;
    }
}

// Function to calculate profile completeness
export const calculateProfileScore = (profileData: any) => {
    const checks = {
        githubUsername: !!profileData.githubUsername?.trim(),
        github: !!(
            profileData.github && Object.keys(profileData.github).length > 0
        ),
        devpostUsername: !!profileData.devpostUsername?.trim(),
        devpost: !!(
            profileData.devpost && Object.keys(profileData.devpost).length > 0
        ),
        resume: !!profileData.resume?.url,
        skills: !!(
            profileData.skills &&
            Array.isArray(profileData.skills) &&
            profileData.skills.length > 0
        ),
        linkedinUrl: !!profileData.linkedinUrl?.trim(),
        portfolioUrl: !!profileData.portfolioUrl?.trim(),
    };

    // Calculate score: each field is worth 12.5 points (100/8)
    const completedCount = Object.values(checks).filter(Boolean).length;
    const score = Math.round((completedCount / 8) * 100);

    return {
        score,
        completed: checks,
    };
};

type ActivityEventSummary = {
    id: string;
    slug?: string;
    title: string;
    description?: string;
    heroImage?: string | null;
    startDate?: string;
    startTime?: string;
    mode?: string;
    location?: string;
    status?: string;
};

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...new Set(
        value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
    )];
};

// --- Structured profile-builder validation (spec 08 §4.1–4.5) ----------------
// Follows this file's existing per-field conventions: validate shape/types,
// trim strings, generate/preserve `id`, and return a 400-friendly `error`
// string on bad input. Arrays are capped sanely so a malformed/oversized
// payload can't bloat the doc.

const MAX_STRUCTURED_ARRAY = 25;
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

const EMPLOYMENT_TYPES = [
    "internship",
    "part-time",
    "full-time",
    "volunteer",
    "co-op",
    "other",
];
const SKILL_CATEGORIES = ["language", "framework", "tool", "soft", "other"];
const SKILL_LEVELS = ["beginner", "intermediate", "advanced"];
const WORK_AUTH_ANSWERS = ["yes", "no", "prefer-not-to-say"];
const WORK_AUTH_STATUSES = [
    "citizen",
    "permanent-resident",
    "study-permit",
    "work-permit",
    "other",
    "prefer-not-to-say",
];

type SanitizeResult<T> =
    | { error: string; value?: undefined }
    | { error?: undefined; value: T };

const trimmedString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const optionalTrimmed = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const preserveOrNewId = (value: unknown): string =>
    typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : crypto.randomUUID();

const normalizeSource = (value: unknown): "manual" | "resume-parse" => {
    const source = trimmedString(value);
    return source === "resume-parse" ? "resume-parse" : "manual";
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

function sanitizeExperiences(input: unknown): SanitizeResult<any[]> {
    if (!Array.isArray(input)) {
        return { error: "experiences must be an array" };
    }
    if (input.length > MAX_STRUCTURED_ARRAY) {
        return {
            error: `Maximum ${MAX_STRUCTURED_ARRAY} experiences allowed`,
        };
    }
    const out: any[] = [];
    for (const raw of input) {
        if (!isPlainObject(raw)) {
            return { error: "Each experience must be an object" };
        }
        const title = trimmedString(raw.title);
        const organization = trimmedString(raw.organization);
        if (!title) return { error: "Experience title is required" };
        if (!organization) {
            return { error: "Experience organization is required" };
        }
        const entry: any = {
            id: preserveOrNewId(raw.id),
            title,
            organization,
            source: normalizeSource(raw.source),
        };
        const employmentType = optionalTrimmed(raw.employmentType);
        if (employmentType) {
            if (!EMPLOYMENT_TYPES.includes(employmentType)) {
                return { error: "Invalid experience employmentType" };
            }
            entry.employmentType = employmentType;
        }
        const location = optionalTrimmed(raw.location);
        if (location) entry.location = location;
        const startDate = optionalTrimmed(raw.startDate);
        if (startDate) {
            if (!YEAR_MONTH_RE.test(startDate)) {
                return { error: "Experience startDate must be YYYY-MM" };
            }
            entry.startDate = startDate;
        }
        const current = raw.current === true;
        if (current) {
            entry.current = true;
            entry.endDate = null;
        } else {
            const endDate = optionalTrimmed(raw.endDate);
            if (endDate) {
                if (!YEAR_MONTH_RE.test(endDate)) {
                    return { error: "Experience endDate must be YYYY-MM" };
                }
                entry.endDate = endDate;
            } else {
                entry.endDate = null;
            }
        }
        const description = optionalTrimmed(raw.description);
        if (description) entry.description = description;
        out.push(entry);
    }
    return { value: out };
}

function sanitizeEducationArray(input: unknown): SanitizeResult<any[]> {
    if (!Array.isArray(input)) {
        return { error: "education must be an array" };
    }
    if (input.length > MAX_STRUCTURED_ARRAY) {
        return { error: `Maximum ${MAX_STRUCTURED_ARRAY} education entries` };
    }
    const out: any[] = [];
    for (const raw of input) {
        if (!isPlainObject(raw)) {
            return { error: "Each education entry must be an object" };
        }
        const school = trimmedString(raw.school);
        const program = trimmedString(raw.program);
        if (!school) return { error: "Education school is required" };
        if (!program) return { error: "Education program is required" };
        const entry: any = {
            id: preserveOrNewId(raw.id),
            school,
            program,
            source: normalizeSource(raw.source),
        };
        const fieldOfStudy = optionalTrimmed(raw.fieldOfStudy);
        if (fieldOfStudy) entry.fieldOfStudy = fieldOfStudy;
        const graduationYear = optionalTrimmed(raw.graduationYear);
        if (graduationYear) {
            if (!/^\d{4}$/.test(graduationYear)) {
                return { error: "Education graduationYear must be a 4-digit year" };
            }
            entry.graduationYear = graduationYear;
        }
        const startYear = optionalTrimmed(raw.startYear);
        if (startYear) {
            if (!/^\d{4}$/.test(startYear)) {
                return { error: "Education startYear must be a 4-digit year" };
            }
            entry.startYear = startYear;
        }
        if (raw.current === true) entry.current = true;
        out.push(entry);
    }
    return { value: out };
}

function sanitizeProjects(input: unknown): SanitizeResult<any[]> {
    if (!Array.isArray(input)) {
        return { error: "projects must be an array" };
    }
    if (input.length > MAX_STRUCTURED_ARRAY) {
        return { error: `Maximum ${MAX_STRUCTURED_ARRAY} projects allowed` };
    }
    const out: any[] = [];
    for (const raw of input) {
        if (!isPlainObject(raw)) {
            return { error: "Each project must be an object" };
        }
        const name = trimmedString(raw.name);
        if (!name) return { error: "Project name is required" };
        const entry: any = {
            id: preserveOrNewId(raw.id),
            name,
            source: normalizeSource(raw.source),
        };
        const description = optionalTrimmed(raw.description);
        if (description) entry.description = description;
        const role = optionalTrimmed(raw.role);
        if (role) entry.role = role;
        const url = optionalTrimmed(raw.url);
        if (url) entry.url = url;
        const startDate = optionalTrimmed(raw.startDate);
        if (startDate) {
            if (!YEAR_MONTH_RE.test(startDate)) {
                return { error: "Project startDate must be YYYY-MM" };
            }
            entry.startDate = startDate;
        }
        const endDate = optionalTrimmed(raw.endDate);
        if (endDate) {
            if (!YEAR_MONTH_RE.test(endDate)) {
                return { error: "Project endDate must be YYYY-MM" };
            }
            entry.endDate = endDate;
        }
        if (Array.isArray(raw.skills)) {
            const skills = [
                ...new Set(
                    raw.skills
                        .filter((s): s is string => typeof s === "string")
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                ),
            ].slice(0, MAX_STRUCTURED_ARRAY);
            if (skills.length > 0) entry.skills = skills;
        }
        out.push(entry);
    }
    return { value: out };
}

function sanitizeSkillsStructured(
    input: unknown
): SanitizeResult<{ structured: any[]; names: string[] }> {
    if (!Array.isArray(input)) {
        return { error: "skillsStructured must be an array" };
    }
    if (input.length > MAX_STRUCTURED_ARRAY) {
        return { error: `Maximum ${MAX_STRUCTURED_ARRAY} skills allowed` };
    }
    const structured: any[] = [];
    const seen = new Set<string>();
    for (const raw of input) {
        if (!isPlainObject(raw)) {
            return { error: "Each skill must be an object" };
        }
        const name = trimmedString(raw.name);
        if (!name) return { error: "Skill name is required" };
        const key = name.toLowerCase();
        if (seen.has(key)) continue; // dedupe by name (case-insensitive)
        seen.add(key);
        const entry: any = { name };
        const category = optionalTrimmed(raw.category);
        if (category) {
            if (!SKILL_CATEGORIES.includes(category)) {
                return { error: "Invalid skill category" };
            }
            entry.category = category;
        }
        const level = optionalTrimmed(raw.level);
        if (level) {
            if (!SKILL_LEVELS.includes(level)) {
                return { error: "Invalid skill level" };
            }
            entry.level = level;
        }
        structured.push(entry);
    }
    return {
        value: { structured, names: structured.map((s) => s.name) },
    };
}

function sanitizeWorkAuthorization(input: unknown): SanitizeResult<any> {
    if (!isPlainObject(input)) {
        return { error: "workAuthorization must be an object" };
    }
    // Server stamps its own updatedAt (never trust the client clock).
    const entry: any = { updatedAt: new Date() };
    if (input.authorizedToWorkInCanada !== undefined) {
        const answer = trimmedString(input.authorizedToWorkInCanada);
        if (!WORK_AUTH_ANSWERS.includes(answer)) {
            return { error: "Invalid authorizedToWorkInCanada" };
        }
        entry.authorizedToWorkInCanada = answer;
    }
    for (const key of [
        "requiresSponsorshipNow",
        "requiresSponsorshipFuture",
    ] as const) {
        const value = input[key];
        if (value === undefined) continue;
        if (value !== null && typeof value !== "boolean") {
            return { error: `${key} must be a boolean or null` };
        }
        entry[key] = value;
    }
    if (input.status !== undefined) {
        const status = trimmedString(input.status);
        if (!WORK_AUTH_STATUSES.includes(status)) {
            return { error: "Invalid work authorization status" };
        }
        entry.status = status;
    }
    return { value: entry };
}

const buildActivityEventSummary = (
    doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): ActivityEventSummary => {
    const data = doc.data() || {};

    return {
        id: doc.id,
        slug: typeof data.slug === "string" ? data.slug : undefined,
        title: typeof data.title === "string" ? data.title : "Untitled event",
        description: typeof data.description === "string" ? data.description : undefined,
        heroImage: typeof data.heroImage === "string" ? data.heroImage : null,
        startDate: typeof data.startDate === "string" ? data.startDate : undefined,
        startTime: typeof data.startTime === "string" ? data.startTime : undefined,
        mode: typeof data.mode === "string" ? data.mode : undefined,
        location: typeof data.location === "string" ? data.location : undefined,
        status: typeof data.status === "string" ? data.status : undefined,
    };
};

const fetchEventsByIds = async (
    eventIds: string[]
): Promise<Map<string, ActivityEventSummary>> => {
    const uniqueIds = normalizeStringArray(eventIds);
    const eventMap = new Map<string, ActivityEventSummary>();

    if (uniqueIds.length === 0) {
        return eventMap;
    }

    const chunkSize = 10;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const snapshot = await db
            .collection("events")
            .where(FieldPath.documentId(), "in", chunk)
            .get();

        snapshot.forEach((doc) => {
            eventMap.set(doc.id, buildActivityEventSummary(doc));
        });
    }

    return eventMap;
};

// GET /profile - Returns the profile of the currently authenticated user
router.get("/", async (req, res) => {
    if (!req.user) {
        return res.status(200).json({});
    }

    try {
        // Fetch the user's profile from Firestore  using email
        const profileDoc = await db
            .collection("profiles")
            .doc(req.user!.uid)
            .get();

        if (!profileDoc.exists) {
            // If no profile document exists, try to get basic info from Auth
            try {
                const tenantAuth = await studentAuth();
                const userRecord = await tenantAuth.getUser(req.user!.uid);

                return res.status(200).json({
                    name: userRecord.displayName || userRecord.email,
                    email: userRecord.email,
                    initials: userRecord.displayName
                        ? userRecord.displayName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .substring(0, 2)
                        : "U",
                    avatar: userRecord.photoURL || null,
                    appliedJobs: [],
                    // Add minimal default values
                });
            } catch (authError) {
                logger.error("Error fetching user record:", authError);
                return res.status(404).json({
                    error: "Profile not found",
                    message: "User profile could not be found",
                });
            }
        }

        const profileData = profileDoc.data()!;

        // Generate URLs for documents if they exist
        if (profileData.resume?.id) {
            const resumeUrl = await generateDocumentUrl(
                req.user!.uid,
                profileData.resume.id,
                "resume"
            );
            if (resumeUrl) {
                profileData.resume.url = resumeUrl;
            }
        }

        if (profileData.coverLetter?.id) {
            const coverUrl = await generateDocumentUrl(
                req.user!.uid,
                profileData.coverLetter.id,
                "cover"
            );
            if (coverUrl) {
                profileData.coverLetter.url = coverUrl;
            }
        }

        if (profileData.grades?.id) {
            const gradesUrl = await generateDocumentUrl(
                req.user!.uid,
                profileData.grades.id,
                "grades"
            );
            if (gradesUrl) {
                profileData.grades.url = gradesUrl;
            }
        }

        // Return the profile data
        return res.status(200).json(profileData);
    } catch (error) {
        logger.error("Error fetching user profile:", error);
        return res.status(500).json({
            error: "Internal server error",
            message: "Failed to retrieve user profile data",
        });
    }
});

router.get("/activity", async (req, res) => {
    try {
        const requestedUserId =
            typeof req.query.userId === "string" && req.query.userId.trim().length > 0
                ? req.query.userId.trim()
                : null;
        const targetUserId = requestedUserId || req.user?.uid || null;

        if (!targetUserId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const requesterId = req.user?.uid || null;
        const isOwnProfile = requesterId === targetUserId;

        const profileDoc = await db.collection("profiles").doc(targetUserId).get();
        if (!profileDoc.exists) {
            return res.status(200).json({
                profile: { userId: targetUserId },
                participation: [],
                wins: [],
            });
        }

        const profileData = profileDoc.data() || {};
        const participatedEventIds = normalizeStringArray(profileData.events);
        const wonEventIds = normalizeStringArray(profileData.wins);
        const referencedEventIds = [...new Set([...participatedEventIds, ...wonEventIds])];

        const eventMap = await fetchEventsByIds(referencedEventIds);

        const isVisibleEvent = (event: ActivityEventSummary): boolean => {
            if (isOwnProfile) {
                return true;
            }

            return event.status === "published";
        };

        const participation = participatedEventIds
            .map((eventId) => eventMap.get(eventId))
            .filter((event): event is ActivityEventSummary => event !== undefined)
            .filter(isVisibleEvent)
            .map((event) => ({
                type: "participation" as const,
                event,
            }));

        const wins: Array<{
            type: "win";
            event: ActivityEventSummary;
            award: {
                id: string;
                type?: string;
                place: number | null;
                title: string;
                prizeDescription?: string;
            };
        }> = [];
        const repairedWinEventIds = new Set<string>();
        const winLookupEventIds = [...new Set([...wonEventIds, ...participatedEventIds])];

        for (const eventId of winLookupEventIds) {
            const event = eventMap.get(eventId);
            if (!event || !isVisibleEvent(event)) {
                continue;
            }

            const awardsSnapshot = await db
                .collection("events")
                .doc(eventId)
                .collection("awards")
                .where("recipientIds", "array-contains", targetUserId)
                .get();

            awardsSnapshot.forEach((awardDoc) => {
                const awardData = awardDoc.data() || {};
                repairedWinEventIds.add(eventId);
                wins.push({
                    type: "win",
                    event,
                    award: {
                        id: awardDoc.id,
                        type:
                            typeof awardData.type === "string"
                                ? awardData.type
                                : undefined,
                        place:
                            typeof awardData.place === "number"
                                ? awardData.place
                                : null,
                        title:
                            typeof awardData.title === "string"
                                ? awardData.title
                                : "Award",
                        prizeDescription:
                            typeof awardData.prizeDescription === "string"
                                ? awardData.prizeDescription
                                : undefined,
                    },
                });
            });
        }

        if (isOwnProfile && repairedWinEventIds.size > 0) {
            const missingWinEventIds = [...repairedWinEventIds].filter(
                (eventId) => !wonEventIds.includes(eventId)
            );

            if (missingWinEventIds.length > 0) {
                await db.collection("profiles").doc(targetUserId).set(
                    {
                        wins: FieldValue.arrayUnion(...missingWinEventIds),
                        updatedAt: new Date(),
                    },
                    { merge: true }
                );
            }
        }

        return res.status(200).json({
            profile: {
                userId: targetUserId,
                firstName:
                    typeof profileData.firstName === "string"
                        ? profileData.firstName
                        : "",
                lastName:
                    typeof profileData.lastName === "string"
                        ? profileData.lastName
                        : "",
            },
            participation,
            wins,
        });
    } catch (error) {
        logger.error("Error fetching profile activity:", error);
        return res.status(500).json({
            error: "Internal server error",
            message: "Failed to retrieve profile activity",
        });
    }
});

/**
 * PATCH /main-resume
 * - Accepts a PDF resume upload using Busboy
 * - Validates the file type and name
 * - Generates a unique resume ID
 * - Uploads to Firebase Storage under /profiles/{userId}/resumes/main_resume/{resumeId}.pdf
 * - Makes file public and stores { id, name, url } under the user's profile
 */
router.patch("/main-resume/", async (req, res): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Log headers for debugging
        logger.info("Request headers:", {
            contentType: req.headers["content-type"],
            contentLength: req.headers["content-length"],
        });

        // Check content-type header
        const contentType = req.headers["content-type"];
        if (!contentType || !contentType.includes("multipart/form-data")) {
            logger.error("Invalid content type:", contentType);
            res.status(400).json({
                error: "Invalid content type. Expected multipart/form-data",
                received: contentType,
            });
            return;
        }

        // Initialize Busboy with proper configuration for Firebase Functions
        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB max
                files: 1, // Only accept 1 file
                fields: 0, // No text fields expected
            },
        });

        let fileBuffer: Buffer | null = null;
        let fileName: string | null = null;
        let fileSizeExceeded = false;
        let fileProcessed = false;
        let responseHandled = false;

        // Handle file upload
        busboy.on(
            "file",
            (
                fieldname: string,
                file: any,
                info: { filename: any; mimeType: any }
            ) => {
                logger.info(`Busboy file event triggered: ${fieldname}`);

                const { filename, mimeType: mime } = info;

                // Validate field name
                if (fieldname !== "resume") {
                    logger.warn(`Invalid field name: ${fieldname}`);
                    file.resume();
                    return;
                }

                // Validate file type (PDF only)
                if (mime !== "application/pdf") {
                    logger.warn(`Invalid mime type: ${mime}`);
                    file.resume();
                    if (!fileProcessed && !responseHandled) {
                        fileProcessed = true;
                        responseHandled = true;
                        res.status(400).json({
                            error: "Only PDF files are allowed",
                        });
                    }
                    return;
                }

                fileName = filename;
                logger.info(`Processing file: ${filename}, type: ${mime}`);

                const chunks: Buffer[] = [];

                file.on("data", (data: Buffer) => {
                    chunks.push(data);
                });

                file.on("limit", () => {
                    logger.warn("File size limit exceeded");
                    fileSizeExceeded = true;
                    file.resume(); // Drain the stream
                });

                file.on("end", () => {
                    if (!fileSizeExceeded) {
                        fileBuffer = Buffer.concat(chunks);
                        logger.info(
                            `File buffered successfully: ${fileBuffer.length} bytes`
                        );
                    }
                });

                file.on("error", (error: any) => {
                    logger.error("File stream error:", error);
                });
            }
        );

        // Handle field (we don't expect any, but log if we get them)
        busboy.on("field", (fieldname: any, value: any) => {
            logger.info(`Unexpected field: ${fieldname} = ${value}`);
        });

        // Handle completion
        busboy.on("finish", async () => {
            logger.info("Busboy finish event triggered");

            if (fileProcessed || responseHandled) {
                logger.info("Response already sent, skipping finish handler");
                return;
            }

            try {
                if (fileSizeExceeded) {
                    responseHandled = true;
                    res.status(400).json({
                        error: "File size exceeds 5MB limit",
                    });
                    return;
                }

                if (!fileBuffer || !fileName) {
                    logger.error(
                        "No file uploaded - fileBuffer or fileName missing",
                        {
                            hasBuffer: !!fileBuffer,
                            hasFileName: !!fileName,
                        }
                    );
                    responseHandled = true;
                    res.status(400).json({
                        error: "No file uploaded",
                        details: {
                            hasBuffer: !!fileBuffer,
                            hasFileName: !!fileName,
                        },
                    });
                    return;
                }

                logger.info(
                    `Processing file: ${fileName}, size: ${fileBuffer.length} bytes`
                );

                // Sanitize file name (letters & spaces only)
                let originalName = fileName.replace(/\.[^/.]+$/, ""); // remove extension
                originalName = originalName.replace(/[^a-zA-Z\s]/g, "").trim(); // keep only letters and spaces
                if (!originalName) originalName = "Resume";

                // Delete any existing resumes in this folder
                const folderPath = `profiles/${userId}/resumes/main_resume/`;
                const [existingFiles] = await storage.bucket().getFiles({
                    prefix: folderPath,
                });
                if (existingFiles.length > 0) {
                    await Promise.all(existingFiles.map((f) => f.delete()));
                    logger.info(
                        `Deleted ${existingFiles.length} old resume file(s) for user ${userId}`
                    );
                }

                // Generate a unique resume ID
                const resumeId = crypto.randomBytes(16).toString("hex");

                // Upload file to Firebase Storage
                const filePath = `profiles/${userId}/resumes/main_resume/${resumeId}.pdf`;
                const storageFile = storage.bucket().file(filePath);

                await storageFile.save(fileBuffer, {
                    contentType: "application/pdf",
                    resumable: false,
                });

                logger.info(`File uploaded to storage: ${filePath}`);

                // Generate download URL
                const downloadUrl = await generateDocumentUrl(
                    userId,
                    resumeId,
                    "resume"
                );

                if (!downloadUrl) {
                    throw new Error("Failed to generate download URL");
                }

                // Save resume metadata to the user's profile
                await db
                    .collection("profiles")
                    .doc(userId)
                    .set(
                        {
                            resume: {
                                id: resumeId,
                                name: originalName,
                                url: downloadUrl,
                                uploadedAt: new Date(),
                            },
                            updatedAt: new Date(),
                        },
                        { merge: true }
                    );

                logger.info(`Resume metadata saved for user ${userId}`);

                responseHandled = true;
                res.status(200).json({
                    success: true,
                    resume: {
                        id: resumeId,
                        name: originalName,
                        url: downloadUrl,
                    },
                });
            } catch (error) {
                logger.error("Error processing resume upload:", error);
                if (!responseHandled) {
                    responseHandled = true;
                    res.status(500).json({
                        error: "Failed to upload resume",
                        details:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
                }
            }
        });

        // Handle errors
        busboy.on("error", (error: { message: any }) => {
            logger.error("Busboy error:", error);
            if (!fileProcessed && !responseHandled) {
                fileProcessed = true;
                responseHandled = true;
                res.status(500).json({
                    error: "Error processing file upload",
                    details:
                        error instanceof Error ? error.message : String(error),
                });
            }
        });

        // Handle both Firebase Functions (rawBody) and local Express (pipe)
        // In production, Firebase pre-parses the request into rawBody
        // In local dev, the stream is still readable
        if ((req as any).rawBody) {
            // Production: Use rawBody
            logger.info("Using rawBody (Firebase Functions)");
            busboy.end((req as any).rawBody);
        } else {
            // Local development: Use pipe
            logger.info("Using pipe (Local Express)");
            req.pipe(busboy);
        }
    } catch (error) {
        logger.error("Error in resume upload handler:", error);
        res.status(500).json({
            error: "Failed to upload resume",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

router.patch("/update", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const updates = req.body;

        // Check if the profile document exists and if email is set
        const profileDoc = await db.collection("profiles").doc(userId).get();

        // If email is not set in the profile, get it from auth
        if (!profileDoc.exists || !profileDoc.data()?.email) {
            try {
                const tenantAuth = await studentAuth();
                const userRecord = await tenantAuth.getUser(userId);

                if (userRecord.email) {
                    // Add email to the updates
                    updates.email = userRecord.email;
                    logger.info(
                        `Setting email for user ${userId}: ${userRecord.email}`
                    );
                }
            } catch (authError) {
                logger.error("Error fetching user email from auth:", authError);
                // Continue with the update even if we can't get the email
            }
        }

        // Validation: First name (required, must contain only letters and spaces)
        if (updates.firstName !== undefined) {
            if (typeof updates.firstName !== "string") {
                return res.status(400).json({
                    error: "Validation error",
                    message: "First name must be a string",
                });
            }
            const trimmedFirstName = updates.firstName.trim();
            if (trimmedFirstName === "") {
                return res.status(400).json({
                    error: "Validation error",
                    message: "First name is required",
                });
            }
            const nameRegex = /^[a-zA-Z\s]+$/;
            if (!nameRegex.test(trimmedFirstName)) {
                return res.status(400).json({
                    error: "Validation error",
                    message: "First name can only contain letters and spaces",
                });
            }
        }

        // Validation: Last name (required, must contain only letters and spaces)
        if (updates.lastName !== undefined) {
            if (typeof updates.lastName !== "string") {
                return res.status(400).json({
                    error: "Validation error",
                    message: "Last name must be a string",
                });
            }
            const trimmedLastName = updates.lastName.trim();
            if (trimmedLastName === "") {
                return res.status(400).json({
                    error: "Validation error",
                    message: "Last name is required",
                });
            }
            const nameRegex = /^[a-zA-Z\s]+$/;
            if (!nameRegex.test(trimmedLastName)) {
                return res.status(400).json({
                    error: "Validation error",
                    message: "Last name can only contain letters and spaces",
                });
            }
        }

        // Validation: Phone (optional, but if provided must be valid)
        if (updates.phone && typeof updates.phone === "string") {
            const trimmedPhone = updates.phone.trim();
            if (trimmedPhone !== "") {
                const phoneRegex = /^[\d\s\-\+\(\)]+$/;
                if (!phoneRegex.test(trimmedPhone)) {
                    return res.status(400).json({
                        error: "Validation error",
                        message:
                            "Phone number can only contain digits, spaces, and +()-",
                    });
                }
                if (trimmedPhone.replace(/\D/g, "").length < 10) {
                    return res.status(400).json({
                        error: "Validation error",
                        message: "Phone number must be at least 10 digits",
                    });
                }
            }
        }

        // Validation: Graduation year (optional, but if provided must be valid)
        if (
            updates.graduationYear &&
            typeof updates.graduationYear === "string"
        ) {
            const trimmedYear = updates.graduationYear.trim();
            if (trimmedYear !== "") {
                const yearRegex = /^\d{4}$/;
                if (!yearRegex.test(trimmedYear)) {
                    return res.status(400).json({
                        error: "Validation error",
                        message:
                            "Graduation year must be a 4-digit year (e.g., 2025)",
                    });
                }
                const year = parseInt(trimmedYear);
                const currentYear = new Date().getFullYear();
                if (year < currentYear - 50 || year > currentYear + 6) {
                    return res.status(400).json({
                        error: "Validation error",
                        message: `Graduation year must be between ${
                            currentYear - 50
                        } and ${currentYear + 6}`,
                    });
                }
            }
        }

        // Validation: LinkedIn URL (optional, but if provided must be valid)
        if (updates.linkedinUrl && typeof updates.linkedinUrl === "string") {
            const trimmedUrl = updates.linkedinUrl.trim();
            if (trimmedUrl !== "") {
                const linkedinRegex =
                    /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[\w-]+\/?$/i;
                if (!linkedinRegex.test(trimmedUrl)) {
                    return res.status(400).json({
                        error: "Validation error",
                        message:
                            "LinkedIn URL must be in format: https://linkedin.com/in/username",
                    });
                }
            }
        }

        // Validation: Devpost username (optional, but if provided must be valid)
        if (
            updates.devpostUsername &&
            typeof updates.devpostUsername === "string"
        ) {
            const trimmedUsername = updates.devpostUsername.trim();
            if (trimmedUsername !== "") {
                const usernameRegex = /^[a-zA-Z0-9_-]+$/;
                if (!usernameRegex.test(trimmedUsername)) {
                    return res.status(400).json({
                        error: "Validation error",
                        message:
                            "Devpost username can only contain letters, numbers, hyphens, and underscores",
                    });
                }
            }
        }

        // Validation: GitHub username (optional, but if provided must be valid)
        if (
            updates.githubUsername &&
            typeof updates.githubUsername === "string"
        ) {
            const trimmedUsername = updates.githubUsername.trim();
            if (trimmedUsername !== "") {
                const githubRegex =
                    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
                if (!githubRegex.test(trimmedUsername)) {
                    return res.status(400).json({
                        error: "Validation error",
                        message:
                            "GitHub username must be 1-39 characters, alphanumeric or hyphens, and cannot start/end with a hyphen",
                    });
                }
            }
        }

        // Validation: Communication language (optional; spec 08 §5 "Language &
        // localization"). Whitelist to "en"/"fr"; `null` clears via the generic
        // FieldValue.delete() branch below. Drives the language of all student
        // communications — it does NOT change the platform UI locale.
        if (
            updates.preferredLanguage !== undefined &&
            updates.preferredLanguage !== null
        ) {
            if (
                updates.preferredLanguage !== "en" &&
                updates.preferredLanguage !== "fr"
            ) {
                return res.status(400).json({
                    error: "Validation error",
                    message: 'preferredLanguage must be "en" or "fr"',
                });
            }
        }

        // Validation: Structured profile-builder fields (spec 08 §4.1–4.5).
        // Each is optional; when present we validate + normalize in place so the
        // generic trim/merge loop below writes the sanitized value verbatim.
        if (updates.experiences !== undefined) {
            const result = sanitizeExperiences(updates.experiences);
            if (result.error) {
                return res.status(400).json({
                    error: "Validation error",
                    message: result.error,
                });
            }
            updates.experiences = result.value;
        }

        if (updates.education !== undefined) {
            const result = sanitizeEducationArray(updates.education);
            if (result.error) {
                return res.status(400).json({
                    error: "Validation error",
                    message: result.error,
                });
            }
            updates.education = result.value;
        }

        if (updates.projects !== undefined) {
            const result = sanitizeProjects(updates.projects);
            if (result.error) {
                return res.status(400).json({
                    error: "Validation error",
                    message: result.error,
                });
            }
            updates.projects = result.value;
        }

        if (updates.workAuthorization !== undefined) {
            const result = sanitizeWorkAuthorization(updates.workAuthorization);
            if (result.error) {
                return res.status(400).json({
                    error: "Validation error",
                    message: result.error,
                });
            }
            updates.workAuthorization = result.value;
        }

        // Structured skills: validate, then mirror the names into the flat
        // `skills: string[]` for back-compat with existing consumers — but only
        // when the client did NOT send an explicit `skills` array in the same
        // request (so an explicit flat-skills edit always wins and is never
        // clobbered by a stale structured list).
        if (updates.skillsStructured !== undefined) {
            const result = sanitizeSkillsStructured(updates.skillsStructured);
            // `error === undefined` (rather than a truthiness check) lets TS
            // narrow the SanitizeResult union so `result.value` is defined
            // below; no sanitizer ever returns an empty-string error.
            if (result.error !== undefined) {
                return res.status(400).json({
                    error: "Validation error",
                    message: result.error,
                });
            }
            updates.skillsStructured = result.value.structured;
            if (updates.skills === undefined) {
                // Cap the flat mirror at 15 to respect the existing skills
                // validator below (structured keeps the full set).
                updates.skills = result.value.names.slice(0, 15);
            }
        }

        // Validation: Skills (optional, array of strings)
        if (updates.skills && Array.isArray(updates.skills)) {
            // Flatten and trim all skills, also split by comma if any skill contains comma
            const processedSkills = updates.skills
                .flatMap((skill: any) => {
                    if (typeof skill === "string") {
                        return skill
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter((s: string) => s.length > 0);
                    }
                    return [];
                })
                .filter((s: string) => s.length > 0);

            if (processedSkills.length > 15) {
                return res.status(400).json({
                    error: "Validation error",
                    message: "Maximum 15 skills allowed",
                });
            }

            // Update the skills with processed array
            updates.skills = processedSkills;
        }

        // Validation: Onboarding state (optional; card dismiss / mark-celebrated).
        // Only the two derived-state exceptions from spec 08 §5 are persisted:
        // `dismissedAt` (card stays hidden) and `celebratedAt` (celebration once).
        // We stamp our own server time when a flag is set, and delete it on null,
        // consistent with the FieldValue.delete() convention below.
        if (updates.onboardingState !== undefined) {
            const incoming = updates.onboardingState;
            if (
                typeof incoming !== "object" ||
                incoming === null ||
                Array.isArray(incoming)
            ) {
                return res.status(400).json({
                    error: "Validation error",
                    message: "onboardingState must be an object",
                });
            }

            const allowedKeys = ["dismissedAt", "celebratedAt"] as const;
            const sanitizedOnboardingState: Record<string, any> = {};
            for (const key of allowedKeys) {
                if (!(key in incoming)) {
                    continue;
                }
                const value = incoming[key];
                if (value === null) {
                    // Explicit clear.
                    sanitizedOnboardingState[key] = FieldValue.delete();
                } else {
                    // Any truthy signal → stamp server time (never trust client clock).
                    sanitizedOnboardingState[key] = new Date();
                }
            }

            updates.onboardingState = sanitizedOnboardingState;
        }

        // Trim all string fields before saving
        const trimmedUpdates: any = {};
        for (const [key, value] of Object.entries(updates)) {
            if (typeof value === "string") {
                trimmedUpdates[key] = value.trim();
            } else if (value === undefined || value === null) {
                // Explicitly delete fields that are undefined or null
                trimmedUpdates[key] = FieldValue.delete();
            } else {
                trimmedUpdates[key] = value;
            }
        }

        // Add updatedAt timestamp
        trimmedUpdates.updatedAt = new Date();

        // Calculate and add profile completeness
        const currentProfile = await db
            .collection("profiles")
            .doc(userId)
            .get();
        const currentData = currentProfile.exists ? currentProfile.data() : {};

        // Merge current data with updates to get the full profile state
        const fullProfileData = { ...currentData, ...trimmedUpdates };

        // Back-compat mirror (spec 08 §4.2): the flat school/program/graduationYear
        // scalars stay AUTHORITATIVE for the required-set / card done-check. We
        // additionally mirror them into the primary education entry (education[0])
        // whenever the scalars or the education array are touched in this request,
        // so `education[0]` always reflects the source-of-truth scalars.
        const scalarsOrEducationTouched =
            updates.school !== undefined ||
            updates.program !== undefined ||
            updates.graduationYear !== undefined ||
            updates.education !== undefined;
        if (scalarsOrEducationTouched) {
            const effSchool = trimmedString(fullProfileData.school);
            const effProgram = trimmedString(fullProfileData.program);
            const effGrad = trimmedString(fullProfileData.graduationYear);
            if (effSchool || effProgram || effGrad) {
                const education = Array.isArray(trimmedUpdates.education)
                    ? [...trimmedUpdates.education]
                    : Array.isArray((currentData as any)?.education)
                    ? [...(currentData as any).education]
                    : [];
                const primary: any = { ...(education[0] || {}) };
                if (!primary.id) primary.id = crypto.randomUUID();
                primary.school = effSchool;
                primary.program = effProgram;
                if (effGrad) primary.graduationYear = effGrad;
                if (primary.source !== "resume-parse") {
                    primary.source = "manual";
                }
                education[0] = primary;
                trimmedUpdates.education = education;
                fullProfileData.education = education;
            }
        }

        const profileScore = calculateProfileScore(fullProfileData);
        trimmedUpdates.profileScore = profileScore;

        // Update the profile with validated and trimmed data
        // Use set with merge: true to create the document if it doesn't exist
        await db
            .collection("profiles")
            .doc(userId)
            .set(trimmedUpdates, { merge: true });

        logger.info(
            `Profile updated for user ${userId}, completeness score: ${profileScore.score}%`
        );

        return res.status(200).json({
            success: true,
            message: "Student updated successfully",
        });
    } catch (error) {
        logger.error("Error updating student:", error);
        return res.status(500).json({
            error: "Failed to update student",
        });
    }
});

/**
 * DELETE /main-resume
 * - Deletes the main resume file from Firebase Storage
 * - Removes the resume metadata from the user's profile
 */
router.delete("/main-resume", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        // Get the current profile to find the resume
        const profileDoc = await db.collection("profiles").doc(userId).get();

        if (!profileDoc.exists) {
            return res.status(404).json({
                error: "Profile not found",
            });
        }

        const profileData = profileDoc.data();
        const resume = profileData?.resume;

        if (!resume || !resume.id) {
            return res.status(404).json({
                error: "No resume found to delete",
            });
        }

        // Delete the file from Firebase Storage
        const filePath = `profiles/${userId}/resumes/main_resume/${resume.id}.pdf`;
        try {
            const storageFile = storage.bucket().file(filePath);
            await storageFile.delete();
            logger.info(`Deleted resume file: ${filePath}`);
        } catch (storageError) {
            logger.warn(
                `Could not delete storage file: ${filePath}`,
                storageError
            );
            // Continue even if file deletion fails (file might already be deleted)
        }

        // Remove the resume metadata from the profile
        await db.collection("profiles").doc(userId).update({
            resume: FieldValue.delete(),
            updatedAt: new Date(),
        });

        logger.info(`Resume metadata removed for user ${userId}`);

        return res.status(200).json({
            success: true,
            message: "Resume deleted successfully",
        });
    } catch (error) {
        logger.error("Error deleting resume:", error);
        return res.status(500).json({
            error: "Failed to delete resume",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * PATCH /cover-letter
 * - Accepts a PDF cover letter upload using Busboy
 * - Validates the file type and name
 * - Generates a unique cover letter ID
 * - Uploads to Firebase Storage under /profiles/{userId}/documents/cover_letters/{coverId}.pdf
 * - Stores { id, name, url } under the user's profile
 */
router.patch("/cover-letter/", async (req, res): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const contentType = req.headers["content-type"];
        if (!contentType || !contentType.includes("multipart/form-data")) {
            logger.error("Invalid content type:", contentType);
            res.status(400).json({
                error: "Invalid content type. Expected multipart/form-data",
                received: contentType,
            });
            return;
        }

        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB max
                files: 1,
                fields: 0,
            },
        });

        let fileBuffer: Buffer | null = null;
        let fileName: string | null = null;
        let fileSizeExceeded = false;
        let fileProcessed = false;
        let responseHandled = false;

        busboy.on(
            "file",
            (
                fieldname: string,
                file: any,
                info: { filename: any; mimeType: any }
            ) => {
                const { filename, mimeType: mime } = info;

                if (fieldname !== "coverLetter") {
                    logger.warn(`Invalid field name: ${fieldname}`);
                    file.resume();
                    return;
                }

                if (mime !== "application/pdf") {
                    logger.warn(`Invalid mime type: ${mime}`);
                    file.resume();
                    if (!fileProcessed && !responseHandled) {
                        fileProcessed = true;
                        responseHandled = true;
                        res.status(400).json({
                            error: "Only PDF files are allowed",
                        });
                    }
                    return;
                }

                fileName = filename;
                const chunks: Buffer[] = [];

                file.on("data", (data: Buffer) => {
                    chunks.push(data);
                });

                file.on("limit", () => {
                    fileSizeExceeded = true;
                    file.resume();
                });

                file.on("end", () => {
                    if (!fileSizeExceeded) {
                        fileBuffer = Buffer.concat(chunks);
                    }
                });
            }
        );

        busboy.on("finish", async () => {
            if (fileProcessed || responseHandled) {
                return;
            }

            try {
                if (fileSizeExceeded) {
                    responseHandled = true;
                    res.status(400).json({
                        error: "File size exceeds 5MB limit",
                    });
                    return;
                }

                if (!fileBuffer || !fileName) {
                    responseHandled = true;
                    res.status(400).json({
                        error: "No file uploaded",
                    });
                    return;
                }

                let originalName = fileName.replace(/\.[^/.]+$/, "");
                originalName = originalName.replace(/[^a-zA-Z\s]/g, "").trim();
                if (!originalName) originalName = "Cover Letter";

                // Delete any existing cover letters in this folder
                const folderPath = `profiles/${userId}/documents/cover_letters/`;
                const [existingFiles] = await storage.bucket().getFiles({
                    prefix: folderPath,
                });
                if (existingFiles.length > 0) {
                    await Promise.all(existingFiles.map((f) => f.delete()));
                }

                const coverId = crypto.randomBytes(16).toString("hex");
                const filePath = `profiles/${userId}/documents/cover_letters/${coverId}.pdf`;
                const storageFile = storage.bucket().file(filePath);

                await storageFile.save(fileBuffer, {
                    contentType: "application/pdf",
                    resumable: false,
                });

                const downloadUrl = await generateDocumentUrl(
                    userId,
                    coverId,
                    "cover"
                );

                if (!downloadUrl) {
                    throw new Error("Failed to generate download URL");
                }

                await db
                    .collection("profiles")
                    .doc(userId)
                    .set(
                        {
                            coverLetter: {
                                id: coverId,
                                name: originalName,
                                url: downloadUrl,
                                uploadedAt: new Date(),
                            },
                            updatedAt: new Date(),
                        },
                        { merge: true }
                    );

                logger.info(`Cover letter saved for user ${userId}`);

                responseHandled = true;
                res.status(200).json({
                    success: true,
                    coverLetter: {
                        id: coverId,
                        name: originalName,
                        url: downloadUrl,
                    },
                });
            } catch (error) {
                logger.error("Error processing cover letter upload:", error);
                if (!responseHandled) {
                    responseHandled = true;
                    res.status(500).json({
                        error: "Failed to upload cover letter",
                        details:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
                }
            }
        });

        busboy.on("error", (error: { message: any }) => {
            if (!fileProcessed && !responseHandled) {
                fileProcessed = true;
                responseHandled = true;
                res.status(500).json({
                    error: "Error processing file upload",
                    details:
                        error instanceof Error ? error.message : String(error),
                });
            }
        });

        if ((req as any).rawBody) {
            busboy.end((req as any).rawBody);
        } else {
            req.pipe(busboy);
        }
    } catch (error) {
        logger.error("Error in cover letter upload handler:", error);
        res.status(500).json({
            error: "Failed to upload cover letter",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * DELETE /cover-letter
 * - Deletes the cover letter file from Firebase Storage
 * - Removes the cover letter metadata from the user's profile
 */
router.delete("/cover-letter", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const profileDoc = await db.collection("profiles").doc(userId).get();

        if (!profileDoc.exists) {
            return res.status(404).json({
                error: "Profile not found",
            });
        }

        const profileData = profileDoc.data();
        const coverLetter = profileData?.coverLetter;

        if (!coverLetter || !coverLetter.id) {
            return res.status(404).json({
                error: "No cover letter found to delete",
            });
        }

        const filePath = `profiles/${userId}/documents/cover_letters/${coverLetter.id}.pdf`;
        try {
            const storageFile = storage.bucket().file(filePath);
            await storageFile.delete();
            logger.info(`Deleted cover letter file: ${filePath}`);
        } catch (storageError) {
            logger.warn(
                `Could not delete storage file: ${filePath}`,
                storageError
            );
        }

        await db.collection("profiles").doc(userId).update({
            coverLetter: FieldValue.delete(),
            updatedAt: new Date(),
        });

        logger.info(`Cover letter metadata removed for user ${userId}`);

        return res.status(200).json({
            success: true,
            message: "Cover letter deleted successfully",
        });
    } catch (error) {
        logger.error("Error deleting cover letter:", error);
        return res.status(500).json({
            error: "Failed to delete cover letter",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * PATCH /grades
 * - Accepts a PDF grades document upload using Busboy
 * - Validates the file type and name
 * - Generates a unique grades ID
 * - Uploads to Firebase Storage under /profiles/{userId}/documents/grades/{gradesId}.pdf
 * - Stores { id, name, url } under the user's profile
 */
router.patch("/grades/", async (req, res): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const contentType = req.headers["content-type"];
        if (!contentType || !contentType.includes("multipart/form-data")) {
            logger.error("Invalid content type:", contentType);
            res.status(400).json({
                error: "Invalid content type. Expected multipart/form-data",
                received: contentType,
            });
            return;
        }

        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB max
                files: 1,
                fields: 0,
            },
        });

        let fileBuffer: Buffer | null = null;
        let fileName: string | null = null;
        let fileSizeExceeded = false;
        let fileProcessed = false;
        let responseHandled = false;

        busboy.on(
            "file",
            (
                fieldname: string,
                file: any,
                info: { filename: any; mimeType: any }
            ) => {
                const { filename, mimeType: mime } = info;

                if (fieldname !== "grades") {
                    logger.warn(`Invalid field name: ${fieldname}`);
                    file.resume();
                    return;
                }

                if (mime !== "application/pdf") {
                    logger.warn(`Invalid mime type: ${mime}`);
                    file.resume();
                    if (!fileProcessed && !responseHandled) {
                        fileProcessed = true;
                        responseHandled = true;
                        res.status(400).json({
                            error: "Only PDF files are allowed",
                        });
                    }
                    return;
                }

                fileName = filename;
                const chunks: Buffer[] = [];

                file.on("data", (data: Buffer) => {
                    chunks.push(data);
                });

                file.on("limit", () => {
                    fileSizeExceeded = true;
                    file.resume();
                });

                file.on("end", () => {
                    if (!fileSizeExceeded) {
                        fileBuffer = Buffer.concat(chunks);
                    }
                });
            }
        );

        busboy.on("finish", async () => {
            if (fileProcessed || responseHandled) {
                return;
            }

            try {
                if (fileSizeExceeded) {
                    responseHandled = true;
                    res.status(400).json({
                        error: "File size exceeds 5MB limit",
                    });
                    return;
                }

                if (!fileBuffer || !fileName) {
                    responseHandled = true;
                    res.status(400).json({
                        error: "No file uploaded",
                    });
                    return;
                }

                let originalName = fileName.replace(/\.[^/.]+$/, "");
                originalName = originalName.replace(/[^a-zA-Z\s]/g, "").trim();
                if (!originalName) originalName = "Grades";

                // Delete any existing grades documents in this folder
                const folderPath = `profiles/${userId}/documents/grades/`;
                const [existingFiles] = await storage.bucket().getFiles({
                    prefix: folderPath,
                });
                if (existingFiles.length > 0) {
                    await Promise.all(existingFiles.map((f) => f.delete()));
                }

                const gradesId = crypto.randomBytes(16).toString("hex");
                const filePath = `profiles/${userId}/documents/grades/${gradesId}.pdf`;
                const storageFile = storage.bucket().file(filePath);

                await storageFile.save(fileBuffer, {
                    contentType: "application/pdf",
                    resumable: false,
                });

                const downloadUrl = await generateDocumentUrl(
                    userId,
                    gradesId,
                    "grades"
                );

                if (!downloadUrl) {
                    throw new Error("Failed to generate download URL");
                }

                await db
                    .collection("profiles")
                    .doc(userId)
                    .set(
                        {
                            grades: {
                                id: gradesId,
                                name: originalName,
                                url: downloadUrl,
                                uploadedAt: new Date(),
                            },
                            updatedAt: new Date(),
                        },
                        { merge: true }
                    );

                logger.info(`Grades document saved for user ${userId}`);

                responseHandled = true;
                res.status(200).json({
                    success: true,
                    grades: {
                        id: gradesId,
                        name: originalName,
                        url: downloadUrl,
                    },
                });
            } catch (error) {
                logger.error("Error processing grades upload:", error);
                if (!responseHandled) {
                    responseHandled = true;
                    res.status(500).json({
                        error: "Failed to upload grades document",
                        details:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
                }
            }
        });

        busboy.on("error", (error: { message: any }) => {
            if (!fileProcessed && !responseHandled) {
                fileProcessed = true;
                responseHandled = true;
                res.status(500).json({
                    error: "Error processing file upload",
                    details:
                        error instanceof Error ? error.message : String(error),
                });
            }
        });

        if ((req as any).rawBody) {
            busboy.end((req as any).rawBody);
        } else {
            req.pipe(busboy);
        }
    } catch (error) {
        logger.error("Error in grades upload handler:", error);
        res.status(500).json({
            error: "Failed to upload grades document",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * DELETE /grades
 * - Deletes the grades document file from Firebase Storage
 * - Removes the grades metadata from the user's profile
 */
router.delete("/grades", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const profileDoc = await db.collection("profiles").doc(userId).get();

        if (!profileDoc.exists) {
            return res.status(404).json({
                error: "Profile not found",
            });
        }

        const profileData = profileDoc.data();
        const grades = profileData?.grades;

        if (!grades || !grades.id) {
            return res.status(404).json({
                error: "No grades document found to delete",
            });
        }

        const filePath = `profiles/${userId}/documents/grades/${grades.id}.pdf`;
        try {
            const storageFile = storage.bucket().file(filePath);
            await storageFile.delete();
            logger.info(`Deleted grades file: ${filePath}`);
        } catch (storageError) {
            logger.warn(
                `Could not delete storage file: ${filePath}`,
                storageError
            );
        }

        await db.collection("profiles").doc(userId).update({
            grades: FieldValue.delete(),
            updatedAt: new Date(),
        });

        logger.info(`Grades metadata removed for user ${userId}`);

        return res.status(200).json({
            success: true,
            message: "Grades document deleted successfully",
        });
    } catch (error) {
        logger.error("Error deleting grades document:", error);
        return res.status(500).json({
            error: "Failed to delete grades document",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /profile/organizations/:id/subscribe
 * Subscribe (follow) a company/organization
 */
router.post("/organizations/:id/subscribe", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { id: organizationId } = req.params;
        const { name, logo } = req.body;

        if (!name) {
            return res.status(400).json({
                error: "Organization name is required",
            });
        }

        const profileRef = db.collection("profiles").doc(userId);
        const profileDoc = await profileRef.get();

        if (!profileDoc.exists) {
            return res.status(404).json({ error: "Profile not found" });
        }

        const profileData = profileDoc.data() || {};
        const organizations = profileData.organizations || [];

        // Check if already subscribed
        const alreadySubscribed = organizations.some(
            (org: any) => org.id === organizationId
        );

        if (alreadySubscribed) {
            return res.status(200).json({
                success: true,
                message: "Already following this organization",
            });
        }

        // Add subscription
        organizations.push({
            id: organizationId,
            name: name,
            logo: logo || null,
            subscribedAt: new Date(),
        });

        await profileRef.update({
            organizations,
            updatedAt: new Date(),
        });

        logger.info(`User ${userId} subscribed to organization ${organizationId}`);

        return res.status(200).json({
            success: true,
            message: `Now following ${name}`,
        });
    } catch (error) {
        logger.error("Error subscribing to organization:", error);
        return res.status(500).json({
            error: "Failed to subscribe to organization",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /profile/organizations/:id/unsubscribe
 * Unsubscribe (unfollow) a company/organization
 */
router.post("/organizations/:id/unsubscribe", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const { id: organizationId } = req.params;

        const profileRef = db.collection("profiles").doc(userId);
        const profileDoc = await profileRef.get();

        if (!profileDoc.exists) {
            return res.status(404).json({ error: "Profile not found" });
        }

        const profileData = profileDoc.data() || {};
        const organizations = profileData.organizations || [];

        // Filter out the organization
        const updatedOrganizations = organizations.filter(
            (org: any) => org.id !== organizationId
        );

        if (updatedOrganizations.length === organizations.length) {
            return res.status(200).json({
                success: true,
                message: "Not following this organization",
            });
        }

        await profileRef.update({
            organizations: updatedOrganizations,
            updatedAt: new Date(),
        });

        logger.info(`User ${userId} unsubscribed from organization ${organizationId}`);

        return res.status(200).json({
            success: true,
            message: "Unfollowed organization successfully",
        });
    } catch (error) {
        logger.error("Error unsubscribing from organization:", error);
        return res.status(500).json({
            error: "Failed to unsubscribe from organization",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * POST /profile/parse-resume
 * Deterministic, offline resume parsing (spec 08 Open-Q1). Loads the caller's
 * already-uploaded resume PDF from Storage, extracts its text with `pdf-parse`
 * (a local library — no network, no per-call cost), and applies rule-based
 * heuristics to return structured SUGGESTIONS shaped like the app's Experience /
 * Education / Project / SkillEntry types. Each parsed entry is tagged
 * `source: "resume-parse"`.
 *
 * This endpoint DOES NOT write anything to the profile — the user confirms and
 * merges on the client (which then saves via PATCH /profile/update). Parsing is
 * always available; a readable-but-empty resume returns empty arrays so the
 * client shows the friendly "add manually" path.
 */
router.post("/parse-resume", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!storage) {
        logger.error("Storage is not initialized for resume parsing");
        return res.status(500).json({
            error: "resume_parse_failed",
            message:
                "We couldn't read your resume automatically. You can fill in your details manually.",
        });
    }

    try {
        // Look up the caller's current resume metadata.
        const profileDoc = await db.collection("profiles").doc(userId).get();
        const resume = profileDoc.exists
            ? profileDoc.data()?.resume
            : undefined;

        if (!resume || !resume.id) {
            return res.status(400).json({
                error: "no_resume",
                message:
                    "Upload a resume first, then try pre-filling from it.",
            });
        }

        // Load the PDF bytes from Storage — same path convention as the
        // PATCH /main-resume handler above.
        const filePath = `profiles/${userId}/resumes/main_resume/${resume.id}.pdf`;
        const file = storage.bucket().file(filePath);

        const [exists] = await file.exists();
        if (!exists) {
            logger.warn(`Resume file not found for parsing: ${filePath}`);
            return res.status(400).json({
                error: "no_resume",
                message:
                    "We couldn't find your uploaded resume. Try re-uploading it.",
            });
        }

        const [buffer] = await file.download();

        const suggestions = await parseResumePdf(buffer);

        logger.info(`Resume parsed for user ${userId}`);

        return res.status(200).json(suggestions);
    } catch (error) {
        // Never leak the key or a stack trace to the client.
        logger.error("Error parsing resume:", error);
        return res.status(502).json({
            error: "resume_parse_failed",
            message:
                "We couldn't read your resume automatically. You can fill in your details manually.",
        });
    }
});

export default router;

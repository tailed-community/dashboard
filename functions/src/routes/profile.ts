import express from "express";
import Busboy from "busboy";
import crypto from "crypto";
import { db, studentAuth, storage } from "../lib/firebase";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

// Function to calculate profile completeness
const calculateProfileScore = (profileData: any) => {
    const checks = {
        githubUsername: !!(
            profileData.githubUsername &&
            profileData.githubUsername.trim() !== ""
        ),
        github: !!(
            profileData.github && Object.keys(profileData.github).length > 0
        ),
        devpostUsername: !!(
            profileData.devpostUsername &&
            profileData.devpostUsername.trim() !== ""
        ),
        devpost: !!(
            profileData.devpost && Object.keys(profileData.devpost).length > 0
        ),
        resume: !!(profileData.resume && profileData.resume.url),
        skills: !!(
            profileData.skills &&
            Array.isArray(profileData.skills) &&
            profileData.skills.length > 0
        ),
        linkedinUrl: !!(
            profileData.linkedinUrl && profileData.linkedinUrl.trim() !== ""
        ),
        portfolioUrl: !!(
            profileData.portfolioUrl && profileData.portfolioUrl.trim() !== ""
        ),
    };

    // Calculate score: each field is worth 12.5 points (100/8)
    const completedCount = Object.values(checks).filter(Boolean).length;
    const score = Math.round((completedCount / 8) * 100);

    return {
        score,
        completed: checks,
    };
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

/**
 * PATCH /main-resume
 * - Accepts a PDF resume upload using Busboy
 * - Validates the file type and name
 * - Generates a unique resume ID
 * - Uploads to Firebase Storage under /resumes/{userId}/main_resume/{resumeId}.pdf
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
        busboy.on("file", (fieldname, file, info) => {
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

            file.on("data", (data) => {
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

            file.on("error", (error) => {
                logger.error("File stream error:", error);
            });
        });

        // Handle field (we don't expect any, but log if we get them)
        busboy.on("field", (fieldname, value) => {
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
                const folderPath = `resumes/${userId}/main_resume/`;
                const [existingFiles] = await storage.getFiles({
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
                const filePath = `resumes/${userId}/main_resume/${resumeId}.pdf`;
                const storageFile = storage.file(filePath);

                await storageFile.save(fileBuffer, {
                    contentType: "application/pdf",
                    resumable: false,
                });

                logger.info(`File uploaded to storage: ${filePath}`);

                // Construct a Firebase public download URL
                const encodedPath = encodeURIComponent(filePath);
                const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodedPath}?alt=media`;

                // Save resume metadata to the user's profile
                await db
                    .collection("profiles")
                    .doc(userId)
                    .set(
                        {
                            resume: {
                                id: resumeId,
                                name: originalName,
                                url: publicUrl,
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
                        url: publicUrl,
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
        busboy.on("error", (error) => {
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
        const filePath = `resumes/${userId}/main_resume/${resume.id}.pdf`;
        try {
            const storageFile = storage.file(filePath);
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

export default router;

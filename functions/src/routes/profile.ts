import express from "express";
import Busboy from "busboy";
import crypto from "crypto";
import { db, studentAuth, storage } from "../lib/firebase";
import { logger } from "firebase-functions";

const router = express.Router();

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
        return res.status(200).json({
            appliedJobs: profileData.appliedJobs || [],
            id: profileData.id,
            name: `${profileData.firstName} ${profileData.lastName}`,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            email: profileData.email,
            initials:
                profileData.initials ||
                profileData.firstName?.charAt(0) +
                    profileData.lastName?.charAt(0) ||
                "U",
            avatar: profileData.avatar || null,
            phone: profileData.phone || null,
            githubUsername: profileData.githubUsername || null,
            devpostUsername: profileData.devpostUsername || null,
            linkedinUrl: profileData.linkedinUrl || null,
            school: profileData.school || null,
            program: profileData.program || null,
            graduationYear: profileData.graduationYear || null,
            createdAt: profileData.createdAt,
            updatedAt: profileData.updatedAt,
            portfolioUrl: profileData.portfolioUrl || null,
            resume: profileData.resume || null,
            // Include any other profile data you want to expose
        });
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
 * - Uploads to Firebase Storage under /resumes/{userId}/main resume/{resumeId}.pdf
 * - Makes file public and stores { id, name, url } under the user's profile
 */
router.patch("/main-resume/", async (req, res): Promise<void> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Initialize Busboy
        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB max
                files: 1, // Only accept 1 file
            },
        });

        let fileBuffer: Buffer | null = null;
        let fileName: string | null = null;
        let mimeType: string | null = null;
        let fileSizeExceeded = false;

        // Handle file upload
        busboy.on("file", (fieldname, file, info) => {
            const { filename, mimeType: mime } = info;

            // Validate field name
            if (fieldname !== "resume") {
                file.resume();
                return;
            }

            // Validate file type (PDF only)
            if (mime !== "application/pdf") {
                file.resume();
                res.status(400).json({ error: "Only PDF files are allowed" });
                return;
            }

            fileName = filename;
            mimeType = mime;

            const chunks: Buffer[] = [];

            file.on("data", (data) => {
                chunks.push(data);
            });

            file.on("limit", () => {
                fileSizeExceeded = true;
                file.resume(); // Drain the stream
            });

            file.on("end", () => {
                if (!fileSizeExceeded) {
                    fileBuffer = Buffer.concat(chunks);
                }
            });
        });

        // Handle completion
        busboy.on("finish", async () => {
            try {
                if (fileSizeExceeded) {
                    return res.status(400).json({
                        error: "File size exceeds 5MB limit",
                    });
                }

                if (!fileBuffer || !fileName) {
                    return res.status(400).json({ error: "No file uploaded" });
                }

                // Validate file type (PDF only)
                if (mimeType !== "application/pdf") {
                    return res
                        .status(400)
                        .json({ error: "Only PDF files are allowed" });
                }

                // Sanitize file name (letters & spaces only)
                let originalName = fileName.replace(/\.[^/.]+$/, ""); // remove extension
                originalName = originalName.replace(/[^a-zA-Z\s]/g, "").trim(); // keep only letters and spaces
                if (!originalName) originalName = "Resume";

                // Delete any existing resumes in this folder
                const folderPath = `resumes/${userId}/main resume/`;
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
                const filePath = `resumes/${userId}/main resume/${resumeId}.pdf`;
                const storageFile = storage.file(filePath);

                await storageFile.save(fileBuffer, {
                    contentType: "application/pdf",
                    resumable: false,
                });

                // Construct a Firebase public download URL (no makePublic, no signed URL)
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

                logger.info(`Resume uploaded for user ${userId}: ${filePath}`);

                return res.status(200).json({
                    success: true,
                    resume: {
                        id: resumeId,
                        name: originalName,
                        url: publicUrl,
                    },
                });
            } catch (error) {
                logger.error("Error processing resume upload:", error);
                return res.status(500).json({
                    error: "Failed to upload resume",
                });
            }
        });

        // Handle errors
        busboy.on("error", (error) => {
            logger.error("Busboy error:", error);
            res.status(500).json({
                error: "Error processing file upload",
            });
        });

        // Pipe the request to busboy
        req.pipe(busboy);
    } catch (error) {
        logger.error("Error uploading resume:", error);
        res.status(500).json({
            error: "Failed to upload resume",
        });
    }
});

router.patch("/update", async (req, res) => {
    const userId = req.user?.uid;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        await db.collection("profiles").doc(userId).update(req.body);

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

export default router;

import express from "express";
const router = express.Router();

import { db, studentAuth } from "../lib/firebase";
import { upsertStudentUser } from "../lib/user-management";
import { z } from "zod";

export const TENANT_IDS = { STUDENTS: process.env.FB_TENANT_ID! } as const;

const createAccountSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    location: z.string().min(1, "Location is required"),
    phoneNumber: z.string().min(1, "Phone number is required"),
    university: z.string().min(1, "University/College is required"),
    major: z.string().min(1, "Major/Program is required"),
    graduationYear: z
        .number()
        .int()
        .min(1950)
        .max(new Date().getFullYear() + 4, "Invalid graduation year"),
});

const checkUserExistsSchema = z.object({
    email: z.string().email(),
});

router.post("/check-user-exists", async (req, res) => {
    try {
        // Validate request body using Zod
        const result = checkUserExistsSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Invalid request data",
                details: result.error.format(),
            });
        }

        const { email } = result.data;
        const tenantAuth = await studentAuth();

        try {
            const user = await tenantAuth.getUserByEmail(email);

            if (user) {
                // Check if user has a profile in Firestore
                const profile = await db
                    .collection("profiles")
                    .doc(user.uid)
                    .get();

                return res.status(200).json({
                    exists: profile.exists,
                    message: profile.exists ? "User exists" : "User not found",
                });
            }
        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
                return res.status(200).json({
                    exists: false,
                    message: "User not found",
                });
            }
            throw error;
        }

        return res.status(200).json({
            exists: false,
            message: "User not found",
        });
    } catch (error: any) {
        console.error("Error checking user existence:", error);
        return res.status(500).json({
            error: "Server error",
            message: "Failed to check user existence. Please try again later.",
        });
    }
});

router.post("/create-account", async (req, res) => {
    try {
        // Validate request body using Zod
        const result = createAccountSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Invalid request data",
                details: result.error.format(),
            });
        }
        const {
            firstName,
            lastName,
            email,
            location,
            phoneNumber,
            university,
            major,
            graduationYear,
        } = result.data;
        const tenantAuth = await studentAuth();

        // Check if user already exists
        try {
            const user = await tenantAuth.getUserByEmail(email);
            let existingUser = null;
            if (user) {
                existingUser = await db
                    .collection("profiles")
                    .doc(user.uid)
                    .get();
            }
            if (existingUser?.exists) {
                return res.status(400).json({
                    error: "Email already in use",
                    message:
                        "This email address is already associated with an account.",
                });
            }
        } catch (error: any) {
            if (error.code !== "auth/user-not-found") {
                throw error;
            }
        }

        // Create new user in Firebase Auth
        const userRecord = await tenantAuth.createUser({
            email,
            emailVerified: false,
        });

        // Create user profile in Firestore
        await db
            .collection("profiles")
            .doc(userRecord.uid)
            .set({
                userId: userRecord.uid,
                firstName,
                lastName,
                email,
                location,
                phone: phoneNumber,
                school: university,
                program: major,
                graduationYear,
                linkedinUrl: null,
                devpost: null,
                initials: `${firstName.charAt(0)}${lastName.charAt(0)}`,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

        return res.status(200).json({
            success: true,
            userId: userRecord.uid,
            message: "Account created successfully",
        });
    } catch (error: any) {
        console.error("Error creating account:", error);

        if (error.code === "auth/email-already-exists") {
            return res.status(400).json({
                error: "Email already in use",
                message:
                    "The email address is already in use by another account.",
            });
        }

        if (error.code === "auth/invalid-phone-number") {
            return res.status(400).json({
                error: "Invalid phone number",
                message: "The phone number provided is invalid.",
            });
        }

        return res.status(500).json({
            error: "Server error",
            message: "Failed to create account. Please try again later.",
        });
    }
});

const ensureAccountSchema = z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    photoURL: z.string().url().optional(),
});

/**
 * POST /auth/ensure-account
 *
 * Auth required (relies on the `decodedToken` middleware populating `req.user`
 * from a verified Bearer token — never trusts a body-supplied email).
 *
 * Ensures a `profiles/{uid}` document exists for the signed-in user. This is
 * the single lenient profile-creation path shared by Google sign-in and
 * email-link sign-in: if the profile is missing it is created with only the
 * minimal fields we have; if it already exists, only currently-missing
 * firstName/lastName/photoURL are filled in. Nothing is ever overwritten.
 */
router.post("/ensure-account", async (req, res) => {
    if (!req.user?.uid) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const email = req.user.email;
    if (!email) {
        return res.status(400).json({
            error: "Missing email",
            message: "The authenticated user has no email on their token.",
        });
    }

    const result = ensureAccountSchema.safeParse(req.body || {});
    if (!result.success) {
        return res.status(400).json({
            error: "Invalid request data",
            details: result.error.format(),
        });
    }

    const { firstName, lastName, photoURL } = result.data;

    try {
        const upsertResult = await upsertStudentUser({
            uid: req.user.uid,
            email,
            firstName,
            lastName,
            photoURL,
            // Google sign-in supplies a photoURL; email-link sign-in never does.
            profileSource: photoURL ? "google" : "email",
        });

        if (upsertResult.error || !upsertResult.userRecord) {
            console.error("Error ensuring account:", upsertResult.error);
            return res.status(500).json({
                error: "Server error",
                message: "Failed to ensure account. Please try again later.",
            });
        }

        return res.status(200).json({
            success: true,
            created: upsertResult.profileCreated,
            profileComplete: upsertResult.profileComplete,
        });
    } catch (error: any) {
        console.error("Error in /auth/ensure-account:", error);
        return res.status(500).json({
            error: "Server error",
            message: "Failed to ensure account. Please try again later.",
        });
    }
});

export default router;

import express from "express";
const router = express.Router();

import { auth, createTenantAuth, db, studentAuth } from "../lib/firebase";
import { z } from "zod";
import { sendEmail } from "../lib/email-service";

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

const sendLoginLinkSchema = z.object({
    email: z.string().email(),
    tenantId: z.string().optional(),
    redirectUrl: z.string().optional(),
});

router.post("/send-login-link", async (req, res) => {
    try {
        const result = sendLoginLinkSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: "Invalid request data",
                details: result.error.format(),
            });
        }

        const { email, tenantId, redirectUrl } = result.data;
        const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5174";
        const callbackUrl = new URL("/auth/callback", frontendBaseUrl);

        if (tenantId) {
            callbackUrl.searchParams.set("tenantId", tenantId);
        }
        if (redirectUrl) {
            callbackUrl.searchParams.set("redirectUrl", redirectUrl);
        }

        const tenantAwareAuth = tenantId
            ? await createTenantAuth(tenantId)
            : auth;

        const signInLink = await tenantAwareAuth.generateSignInWithEmailLink(email, {
            url: callbackUrl.toString(),
            handleCodeInApp: true,
        });

        await sendEmail({
            to: email,
            subject: "Your Tail'ed sign-in link",
            html: `
                <p>Hello,</p>
                <p>Click the link below to sign in:</p>
                <p><a href="${signInLink}">${signInLink}</a></p>
                <p>If you did not request this email, you can ignore it.</p>
            `,
            text: `Sign in to Tail'ed: ${signInLink}`,
        });

        return res.status(200).json({
            success: true,
            message: "Sign-in link sent",
        });
    } catch (error) {
        console.error("Error sending sign-in link:", error);
        return res.status(500).json({
            error: "Server error",
            message: "Failed to send sign-in link. Please try again later.",
        });
    }
});


const findProfileByEmail = async (email: string) => {
    const emailLower = email.toLowerCase();

    const byLower = await db
        .collection("profiles")
        .where("emailLower", "==", emailLower)
        .limit(1)
        .get();
    if (!byLower.empty) return byLower.docs[0];

    const byEmail = await db
        .collection("profiles")
        .where("email", "==", email)
        .limit(1)
        .get();
    if (!byEmail.empty) return byEmail.docs[0];

    if (emailLower !== email) {
        const byNormalizedEmail = await db
            .collection("profiles")
            .where("email", "==", emailLower)
            .limit(1)
            .get();
        if (!byNormalizedEmail.empty) return byNormalizedEmail.docs[0];
    }

    return null;
};

const findPendingProfileByEmail = async (email: string) => {
    const emailLower = email.toLowerCase();
    const pendingDoc = await db.collection("pendingProfiles").doc(emailLower).get();
    return pendingDoc.exists ? pendingDoc : null;
};

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
        const normalizedEmail = email.toLowerCase();

        const existingProfile = await findProfileByEmail(normalizedEmail);
        if (existingProfile) {
            return res.status(200).json({
                exists: true,
                pendingAuthSync: false,
                message: "User exists",
            });
        }

        const pendingProfile = await findPendingProfileByEmail(normalizedEmail);
        if (pendingProfile) {
            return res.status(200).json({
                exists: true,
                pendingAuthSync: true,
                message: "User exists",
            });
        }

        try {
            const tenantAuth = await studentAuth();
            const user = await tenantAuth.getUserByEmail(email);

            if (user) {
                const profile = await db.collection("profiles").doc(user.uid).get();

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

export default router;

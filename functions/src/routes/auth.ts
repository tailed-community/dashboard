import express from "express";
const router = express.Router();

import { db, studentAuth } from "../lib/firebase";
import { upsertStudentUser } from "../lib/user-management";
import { localeFromAcceptLanguage } from "../lib/locale";
import { buildSignInLink } from "../lib/auth-links";
import { sendSignInLinkEmail } from "../lib/email-service";
import { z } from "zod";

const checkUserExistsSchema = z.object({
    email: z.string().email(),
});

// Accepts an in-app redirect PATH (e.g. "/jobs"), never an absolute URL — it is
// embedded on the /auth/callback continue URL by buildSignInLink and consumed by
// the callback page's client-side navigate().
const sendLoginLinkSchema = z.object({
    email: z.string().email("Invalid email address"),
    redirectUrl: z.string().optional(),
});

/**
 * POST /auth/send-login-link  (public — no auth required)
 *
 * Passwordless sign-in for the interactive sign-in / sign-up form. Generates a
 * one-time email sign-in link server-side (firebase-admin, tenant-aware) and
 * delivers it through our own "Warm Community" email template — replacing
 * Firebase's client-SDK sendSignInLinkToEmail and its default email.
 *
 * No existence pre-check: for a new email the link creates the account on
 * completion, matching the form's "sign in or sign up" behavior. The response is
 * intentionally uniform (never reveals whether the email already has an account).
 */
router.post("/send-login-link", async (req, res) => {
    const result = sendLoginLinkSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid request data",
            details: result.error.format(),
        });
    }

    const { email, redirectUrl } = result.data;
    const locale = localeFromAcceptLanguage(req.headers["accept-language"]);

    try {
        const signInUrl = await buildSignInLink(
            email,
            redirectUrl && redirectUrl.length > 0 ? redirectUrl : "/me"
        );
        await sendSignInLinkEmail(email, signInUrl, locale);

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error("Error sending sign-in link:", error);
        return res.status(500).json({
            error: "Server error",
            message: "Failed to send the sign-in link. Please try again later.",
        });
    }
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

/**
 * `POST /auth/create-account` was REMOVED.
 *
 * It was unauthenticated (the global `decodedToken` middleware only populates
 * `req.user` — it never rejects), so any caller could create a Firebase Auth
 * user plus a `profiles/{uid}` doc with an arbitrary email. Nothing in the app
 * called it: the only reference was a commented-out example in
 * `src/lib/fetch.ts`. Account provisioning now goes exclusively through
 * `POST /auth/ensure-account` below, which derives both uid and email from a
 * verified ID token.
 */

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

    // First-login provisioning (Google / email-link): seed the new profile's
    // preferredLanguage from the browser's Accept-Language, mirroring the public
    // alert-capture endpoint. This only takes effect when a profile is created —
    // upsertStudentUser never overwrites an existing profile's preferredLanguage,
    // so a returning user's saved FR/EN choice is preserved. Primary language tag
    // starts-with "fr" → "fr", else "en".
    const acceptLanguageLocale = localeFromAcceptLanguage(
        req.headers["accept-language"]
    );

    try {
        const upsertResult = await upsertStudentUser({
            uid: req.user.uid,
            email,
            firstName,
            lastName,
            photoURL,
            // Google sign-in supplies a photoURL; email-link sign-in never does.
            profileSource: photoURL ? "google" : "email",
            preferredLanguage: acceptLanguageLocale,
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

import express from "express";
const router = express.Router();

import { db, studentAuth } from "../lib/firebase";
import { z } from "zod";
import { sendVerificationEmail } from "../lib/email-service";
import { sendNotificationEmail } from "../lib/email-service";

export const TENANT_IDS = { STUDENTS: "students-hactj" } as const;

const createAccountSchema = z.object({
  schoolName: z.string().min(2),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
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
    const { firstName, lastName, email, phoneNumber } = result.data;
    const tenantAuth = await studentAuth();
    try {
      const existingUser = await tenantAuth.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: "Email already in use",
          message: "This email address is already associated with an account.",
        });
      }
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const userRecord = await tenantAuth.createUser({
      email,
      emailVerified: false,
      displayName: `${firstName} ${lastName}`,
      phoneNumber: phoneNumber || null,
      disabled: false,
    });

    await db
      .collection("profiles")
      .doc(userRecord.uid)
      .set({
        userId: userRecord.uid,
        firstName,
        lastName,
        email,
        phone: phoneNumber || null,
        initials: `${firstName.charAt(0)}${lastName.charAt(0)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL}/auth/callback`,
      handleCodeInApp: true,
    };

    const link = await tenantAuth.generateSignInWithEmailLink(
      email,
      actionCodeSettings,
    );

    try {
      process.env.NODE_ENV === "development"
        ? console.log(
            `To verify the account linked to ${email} click this link: ${link}`,
          )
        : await sendVerificationEmail(email, link);

      // New Contact Form Submission
      await sendNotificationEmail(
        process.env.ADMIN_EMAIL || "info@tailed.ca",
        "New Account Creation",
        `   
          <div style="margin-bottom: 20px;">
            <p><strong>New account creation received:</strong></p>
            <p><strong>firstName:</strong> ${firstName}</p>
            <p><strong>lastName:</strong> ${lastName}</p>
            <p><strong>email:</strong> ${email}</p>
            <p><strong>phoneNumber:</strong> ${phoneNumber}</p>
          </div>
        `,
      );
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      // Continue with success response even if email fails
    }

    console.log("Account created successfully for:", email);

    return res.status(200).json({
      success: true,
      userId: userRecord.uid,
      message:
        "Account created successfully. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Error creating account:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({
        error: "Email already in use",
        message: "The email address is already in use by another account.",
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

router.post("/account-exists", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const tenantAuth = await studentAuth();
    const userRecord = await tenantAuth.getUserByEmail(email);

    if (userRecord) {
      const profile = await db.collection("profiles").doc(userRecord.uid).get();
      if (profile.exists) {
        return res.status(200).json({ exists: true });
      } else {
        return res.status(404).json({
          error: {
            code: "auth/user-not-found",
            message:
              "There is no record corresponding to the provided identifier",
          },
        });
      }
    } else {
      return res.status(404).json({
        error: {
          code: "auth/user-not-found",
          message:
            "There is no record corresponding to the provided identifier",
        },
      });
    }
  } catch (error) {
    // TODO: Throw error based on error code
    return res.status(500).json({ error: error });
  }
});

export default router;

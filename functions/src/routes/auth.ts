import express from "express";
const router = express.Router();

import { db, studentAuth } from "../lib/firebase";
import { z } from "zod";

export const TENANT_IDS = { STUDENTS: "students-hactj" } as const;

const createAccountSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email(),
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
    const { firstName, lastName, email } = result.data;
    const tenantAuth = await studentAuth();
    try {
      const user = await tenantAuth.getUserByEmail(email);
      let existingUser = null;
      if (user) {
        existingUser = await db.collection("profiles").doc(user.uid).get();
      }
      if (existingUser?.exists) {
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

    const userRecord = await tenantAuth.getUserByEmail(email);

    await db
      .collection("profiles")
      .doc(userRecord.uid)
      .set({
        userId: userRecord.uid,
        firstName: firstName || null,
        lastName: lastName || null,
        email,
        phone: null,
        school: null,
        program: null,
        graduationYear: null,
        linkedin: null,
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

export default router;

import express from "express";

import { db, auth } from "../lib/firebase";
import { logger } from "firebase-functions";

const router = express.Router();

// GET /profile - Returns the profile of the currently authenticated user
router.get("/", async (req, res) => {
  try {
    // Get the user's ID from the authenticated request
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User is not authenticated",
      });
    }

    // Fetch the user's profile from Firestore
    const profileDoc = await db.collection("profiles").doc(userId).get();

    if (!profileDoc.exists) {
      // If no profile document exists, try to get basic info from Auth
      try {
        const userRecord = await auth.getUser(userId);

        return res.status(200).json({
          name: userRecord.displayName || "User",
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

    const profileData = profileDoc.data();

    // Return the profile data
    return res.status(200).json({
      id: profileDoc.id,
      name: `${profileData.firstName} ${profileData.lastName}`,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      initials:
        profileData.initials ||
        profileData.firstName?.charAt(0) + profileData.lastName?.charAt(0) ||
        "U",
      avatar: profileData.avatar || null,
      phone: profileData.phone || null,
      createdAt: profileData.createdAt,
      updatedAt: profileData.updatedAt,
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

export default router;

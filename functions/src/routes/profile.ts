import express from "express";

import { db, studentAuth } from "../lib/firebase";
import { logger } from "firebase-functions";

const router = express.Router();

// GET /profile - Returns the profile of the currently authenticated user
router.get("/", async (req, res) => {
  if (!req.user) {
    return res.status(200).json({});
  }

  try {
    // Fetch the user's profile from Firestore  using email
    const profileDoc = await db.collection("profiles").doc(req.user!.uid).get();

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
          appliedJobIds: [],
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
      id: profileData.id,
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
      devpostUsername: profileData.devpostUsername || null,
      linkedinUrl: profileData.linkedinUrl || null,
      school: profileData.school || null,
      program: profileData.program || null,
      graduationYear: profileData.graduationYear || null,
      createdAt: profileData.createdAt,
      updatedAt: profileData.updatedAt,
      portfolioUrl: profileData.portfolioUrl || null,
      appliedJobIds: profileData.appliedJobIds || [],
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

router.patch("/:id", async (request, response) => {
  const userId = request.user!.uid;

  const document = await db.collection("profiles").doc(userId).get();

  // First check if the document we want to update exists
  if (!document.exists) {
    response.status(404).json({ error: "Document does not exist" });
    return;
  }

  const promise = db
    .collection("profiles")
    .doc(document.id)
    .update(request.body);
  promise.then(() => {
    response.sendStatus(200);
    return;
  });
});

export default router;

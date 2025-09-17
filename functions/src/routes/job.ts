import express from "express";

import { db } from "../lib/firebase";
import { logger } from "firebase-functions";

const router = express.Router();

// GET /applied-job - Returns the applied job IDs for the currently authenticated user
router.get("/applied-jobs", async (req, res) => {
  if (!req.user) {
    return res.status(200).json({});
  }

  try {
    const profileDoc = await db.collection("profiles").doc(req.user.uid).get();

    if (!profileDoc.exists) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profileData = profileDoc.data()!;
    const appliedJobIds = profileData.appliedJobIds || [];

    return res.status(200).json(appliedJobIds);
  } catch (error) {
    logger.error("Error fetching applied jobs:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve applied job data",
    });
  }
});

export default router;

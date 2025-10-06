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
        const profileDoc = await db
            .collection("profiles")
            .doc(req.user.uid)
            .get();

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

// PATCH /applied-jobs/:jobId - Add a job ID to the authenticated user's appliedJobIds
router.patch("/applied-jobs/:jobId", async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { jobId } = req.params;
        const userId = req.user.uid;

        if (!jobId) {
            return res.status(400).json({ error: "Missing jobId parameter" });
        }

        const profileRef = db.collection("profiles").doc(userId);
        const profileDoc = await profileRef.get();

        if (!profileDoc.exists) {
            return res.status(404).json({ error: "Profile not found" });
        }

        const profileData = profileDoc.data() || {};
        const appliedJobIds: string[] = profileData.appliedJobIds || [];

        // Avoid adding duplicates
        if (appliedJobIds.includes(jobId)) {
            return res.status(200).json({
                success: true,
                message: "Job already in appliedJobIds",
                appliedJobIds,
            });
        }

        // Add the jobId to the array
        appliedJobIds.push(jobId);

        // Update the document
        await profileRef.update({ appliedJobIds });

        return res.status(200).json({
            success: true,
            message: "Job ID added to appliedJobIds",
            appliedJobIds,
        });
    } catch (error) {
        logger.error("Error updating appliedJobIds:", error);
        return res.status(500).json({
            error: "Internal server error",
            message: "Failed to update applied job data",
        });
    }
});

export default router;

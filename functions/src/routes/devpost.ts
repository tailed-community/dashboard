import express from "express";
import { db } from "../lib/firebase";
import { logger } from "firebase-functions";

const router = express.Router();

// Define interfaces for the returned data structures
// interface DevpostResponse {
//   success: boolean;
//   data?: any;
//   errors?: string[];
// }

interface ProjectDetails {
  title: string;
  description: string;
  gallery: Array<{ url: string; caption: string }>;
  built_with: string[];
  app_links: string[];
  submitted_to: string[];
  created_by: string[];
  updates: any[];
  likes: number;
  technologies?: string[];
  prizes: Array<{
    prize_text: string;
    hackathon_name: string;
    hackathon_url: string;
  }>;
  link: string;
}

// interface HackathonDetails {
//   name: string;
//   description: string;
//   deadline: string;
//   participants: string;
//   prizes: Array<{
//     title: string;
//     details: string;
//   }>;
//   sponsors: Array<{
//     name: string;
//     logo: string;
//     link: string;
//     category: string;
//   }>;
//   rules_link: string;
// }

/**
 * Calls the Devpost scraping API hosted as an AWS Lambda
 * @param endpoint The API endpoint to call (e.g., /user/{username}, /project/{projectname})
 */
async function callDevpostAPI(endpoint: string) {
  // Ensure endpoint starts with /
  if (!endpoint.startsWith("/")) {
    endpoint = "/" + endpoint;
  }

  const headers = {
    "x-api-key": process.env.DEVPOST_API_KEY || "",
  };
  const url =
    "https://3fqfekw0u5.execute-api.us-east-1.amazonaws.com/Prod" + endpoint;

  try {
    const response = await fetch(url, { headers });

    if (response.status !== 200) {
      logger.error(
        `Devpost API error: ${response.status} - ${await response.text()}`
      );
      return {
        success: false,
        errors: [`Couldn't call the Devpost API (Status: ${response.status})`],
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    logger.error(`Error calling Devpost API: ${error}`);
    return {
      success: false,
      errors: ["Couldn't call the Devpost API", error],
    };
  }
}

/**
 * Fetches detailed hackathon data from the Devpost API
 * @param hackathonId The ID of the hackathon
 */
async function fetchHackathonDetails(hackathonId: string): Promise<any> {
  try {
    const endpoint = `/hackathon/${hackathonId}`;
    const response = await callDevpostAPI(endpoint);

    if (!response.success) {
      logger.error(`Failed to fetch hackathon details for ${hackathonId}`);
      return null;
    }

    return response.data;
  } catch (error) {
    logger.error(`Error fetching hackathon details for ${hackathonId}:`, error);
    return null;
  }
}

/**
 * Fetches detailed project data from the Devpost API
 * @param projectId The ID of the project
 */
async function fetchProjectDetails(projectId: string): Promise<any> {
  try {
    const endpoint = `/project/${projectId}`;
    const response = await callDevpostAPI(endpoint);

    if (!response.success) {
      logger.error(`Failed to fetch project details for ${projectId}`);
      return null;
    }

    return response.data;
  } catch (error) {
    logger.error(`Error fetching project details for ${projectId}:`, error);
    return null;
  }
}

// POST /devpost/profile - Fetch comprehensive Devpost data for a given username
router.post("/profile", async (req, res) => {
  try {
    const username = req.body?.username;
    const saveProfile = true;

    const uid = req.user?.uid || null;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized - Missing user ID",
      });
    }

    if (!username || typeof username !== "string") {
      return res.status(400).json({
        success: false,
        error: "Valid Devpost username is required",
      });
    }

    // Fetch user data from Devpost API
    const endpoint = `/user/${username}`;
    const response = await callDevpostAPI(endpoint);

    if (!response.success) {
      return res.status(400).json({
        success: false,
        error:
          "Failed to fetch data from Devpost. Please check the username and try again.",
      });
    }

    const userData = response.data;

    // Extract projects data
    const projects = userData.projects || [];
    const winningProjects = projects.filter((project: any) => project.did_win);

    // Extract hackathons data
    const hackathons = userData.hackathons || [];

    // Enrich hackathons data with additional details
    const enrichedHackathons = await Promise.all(
      hackathons.slice(0, 5).map(async (hackathon: string) => {
        // Only fetch details for the first 5 hackathons to avoid overwhelming the API
        const details = await fetchHackathonDetails(hackathon);
        return details
          ? {
              id: hackathon,
              ...details,
            }
          : { id: hackathon };
      })
    );

    // Create combined project and hackathon data
    const combinedProjectsAndHackathons = await Promise.all(
      projects.map(async (project: any) => {
        // Find associated hackathon if it exists
        const associatedHackathon = hackathons.find(
          (hackathon: any) => hackathon.name === project.hackathon_name
        );

        // Determine win status
        let winStatus = "no";
        if (project.did_win) {
          if (
            project.software_roles?.some(
              (role: string) =>
                role.toLowerCase().includes("winner") ||
                role.toLowerCase().includes("1st place")
            )
          ) {
            winStatus = "1st place";
          } else {
            // Extract category if available
            const categoryPrize = project.software_roles?.find(
              (role: string) =>
                role.toLowerCase().includes("prize") ||
                role.toLowerCase().includes("award")
            );
            winStatus = categoryPrize || "yes";
          }
        }

        // Get enriched project data
        let enrichedProjectData: Partial<ProjectDetails> = {};
        try {
          // Extract project identifier from URL
          const projectId = project.link || project.url?.split("/").pop();
          if (projectId) {
            enrichedProjectData = (await fetchProjectDetails(projectId)) || {};
            if (Object.keys(enrichedProjectData).length > 0) {
              logger.info(
                `Successfully enriched data for project: ${project.name}`
              );
            }
          }
        } catch (error) {
          logger.error(
            `Error enriching project data for ${project.name}:`,
            error
          );
        }

        // Get associated hackathon details if available
        let hackathonDetails = null;
        if (associatedHackathon) {
          const hackathonName =
            typeof associatedHackathon === "string"
              ? associatedHackathon
              : associatedHackathon.name?.split(".")[0] || "";

          if (hackathonName) {
            hackathonDetails =
              enrichedHackathons.find((h) => h.id === hackathonName) || null;
          }
        }

        return {
          project: project.name || enrichedProjectData?.title || "",
          project_link:
            project.url || `https://devpost.com/software/${project.link}` || "",
          github_link:
            project.github_url ||
            (enrichedProjectData?.app_links &&
              enrichedProjectData.app_links.find((link: string) =>
                link.includes("github.com")
              )) ||
            "",
          hackathon:
            project.hackathon_name ||
            enrichedProjectData?.submitted_to?.[0] ||
            "",
          hackathon_link: associatedHackathon?.url || "",
          win: winStatus,
          year: associatedHackathon
            ? new Date(associatedHackathon.date || "").getFullYear() || null
            : null,
          technologies:
            project.technologies || enrichedProjectData?.built_with || [],
          // Add enriched project data
          description:
            enrichedProjectData?.description || project.tagline || "",
          members: enrichedProjectData?.created_by || [],
          built_with: enrichedProjectData?.built_with || [],
          detailed_technologies: enrichedProjectData?.technologies || [],
          images:
            enrichedProjectData?.gallery?.map((item: any) => item.url) || [],
          video:
            enrichedProjectData?.gallery?.find(
              (item: any) =>
                item.url.includes("youtube") || item.url.includes("vimeo")
            )?.url || "",
          likes: enrichedProjectData?.likes || 0,
          prizes: enrichedProjectData?.prizes || [],
          // Add hackathon details if available
          hackathon_details: hackathonDetails
            ? {
                description: hackathonDetails.description,
                deadline: hackathonDetails.deadline,
                participants: hackathonDetails.participants,
                prizes: hackathonDetails.prizes,
                sponsors: hackathonDetails.sponsors?.slice(0, 5) || [],
              }
            : null,
        };
      })
    );

    // Calculate participation stats
    const participationByYear: Record<string, number> = {};
    hackathons.forEach((hackathon: any) => {
      const year = new Date(hackathon.date || "").getFullYear();
      if (year && !isNaN(year)) {
        participationByYear[year] = (participationByYear[year] || 0) + 1;
      }
    });

    // Organize comprehensive user profile
    const comprehensiveProfile = {
      // Basic user info
      username: userData.username,
      name: userData.name,
      links: userData.links,
      bio: userData.bio,
      location: userData.location || "",
      image: userData.image || "",
      followers: userData.followers || 0,
      following: userData.following || 0,

      // Statistics
      stats: {
        projectCount: projects.length,
        hackathonCount: hackathons.length,
        winCount: winningProjects.length,
        likedProjectsCount: userData.likes?.length || 0,
      },

      // Combined projects and hackathons information
      projectsAndHackathons: combinedProjectsAndHackathons,

      // Achievements
      achievements: {
        badges: userData.achievements || [],
      },

      // Metadata
      lastUpdated: new Date().toISOString(),
    };

    // Save profile to database if requested
    if (saveProfile === true) {
      try {
        await db
          .collection("profiles")
          .doc(uid)
          .set({ devpost: comprehensiveProfile }, { merge: true });
        logger.info(`Saved Devpost profile for user: ${username}`);
      } catch (dbError) {
        logger.error("Error saving Devpost profile to database:", dbError);
        // Continue execution to return profile even if save fails
      }
    }

    return res.status(200).json({
      success: true,
      data: comprehensiveProfile,
    });
  } catch (error) {
    logger.error("Error fetching comprehensive Devpost profile:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch Devpost account data",
    });
  }
});

// GET /devpost/profile/:username - Retrieve saved Devpost profile
router.get("/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: "Username is required",
      });
    }

    const profileDoc = await db
      .collection("devpostProfiles")
      .doc(username)
      .get();

    if (!profileDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: profileDoc.data(),
    });
  } catch (error) {
    logger.error("Database error retrieving Devpost profile:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve profile data",
    });
  }
});

export default router;

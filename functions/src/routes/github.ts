import express from "express";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { calculateProfileScore } from "./profile";

interface GithubUser {
    login: string;
    name: string;
    avatar_url: string;
    bio: string;
    followers: number;
    public_repos: number;
    email?: string;
    location?: string;
    company?: string;
    blog?: string;
    twitter_username?: string;
    created_at?: string;
    updated_at?: string;
}

interface GithubRepo {
    language: string;
    stargazers_count?: number;
    forks_count?: number;
    fork?: boolean;
    name?: string;
    description?: string;
    html_url?: string;
    created_at?: string;
    updated_at?: string;
    owner?: {
        login: string;
    };
    visibility?: string;
    watchers_count?: number;
    topics?: string[];
}

interface LanguageStats {
    language: string;
    count: number;
    percentage: number;
    size?: number;
    projects?: number;
}

interface ContributionDay {
    contributionCount: number;
    date: string;
}

interface WeeklyContributions {
    week: string;
    count: number;
    days: ContributionDay[];
}

const router = express.Router();

// POST /github/profile
router.post("/profile", async (req, res) => {
    try {
        // Get GitHub token from request body
        const githubToken = req.body?.githubToken;
        const saveProfile = true;

        const uid = req.user?.uid || null;

        logger.info(`GitHub profile request for user: ${uid}`);

        if (!uid) {
            logger.error("Missing user ID in GitHub profile request");
            return res.status(401).json({
                success: false,
                error: "Unauthorized - Missing user ID",
            });
        }

        if (!githubToken) {
            logger.error(`Missing GitHub token for user: ${uid}`);
            return res.status(401).json({
                error: "GitHub token is required in the request body",
            });
        }

        logger.info(`Processing GitHub profile for user: ${uid}`);

        // Use GitHub token for authorization
        const authHeader = `Bearer ${githubToken}`;

        // First, get the authenticated user info to extract username
        const authUserResponse = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: authHeader,
                Accept: "application/vnd.github.v3+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!authUserResponse.ok) {
            logger.error(
                `GitHub auth failed: ${authUserResponse.status} ${authUserResponse.statusText}`
            );
            const errorText = await authUserResponse.text();
            logger.error(`Auth error response: ${errorText}`);
            return res
                .status(authUserResponse.status)
                .json({ error: "Failed to authenticate with GitHub token" });
        }

        const authUser = await authUserResponse.json();
        const username = authUser.login;

        logger.info(`Authenticated GitHub user: ${username}`);

        // Fetch user data
        const userResponse = await fetch(
            `https://api.github.com/users/${username}`,
            {
                headers: {
                    Authorization: authHeader,
                    Accept: "application/vnd.github.v3+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            }
        );

        if (!userResponse.ok) {
            return res
                .status(userResponse.status)
                .json({ error: "GitHub user not found" });
        }

        const user: GithubUser = await userResponse.json();

        // Fetch user's repositories to get language stats with more details
        const reposResponse = await fetch(
            `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
            {
                headers: {
                    Authorization: authHeader,
                    Accept: "application/vnd.github.v3+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            }
        );

        const repos: GithubRepo[] = await reposResponse.json();

        // Calculate top languages with more metadata
        const languageCounts: Record<
            string,
            { count: number; repos: string[] }
        > = {};
        repos.forEach((repo) => {
            if (repo.language) {
                if (!languageCounts[repo.language]) {
                    languageCounts[repo.language] = { count: 0, repos: [] };
                }
                languageCounts[repo.language].count++;
                if (repo.name) {
                    languageCounts[repo.language].repos.push(repo.name);
                }
            }
        });

        const topLanguages = Object.entries(languageCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([language]) => language);

        // GraphQL query for contribution count and more detailed info
        // Note: GitHub API returns last year of contributions by default
        const query = `
      query($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                  weekday
                }
                firstDay
              }
            }
            commitContributionsByRepository {
              contributions {
                totalCount
              }
              repository {
                name
                nameWithOwner
                primaryLanguage {
                  name
                }
              }
            }
          }
          following {
            totalCount
          }
          organizations(first: 10) {
            totalCount
            nodes {
              login
              name
              avatarUrl
            }
          }
          pullRequests(first: 1) {
            totalCount
          }
          issues(first: 1) {
            totalCount
          }
          repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]) {
            totalCount
          }
          starredRepositories {
            totalCount
          }
          pinnedItems(first: 6, types: [REPOSITORY]) {
            nodes {
              ... on Repository {
                name
                description
                stargazerCount
                primaryLanguage {
                  name
                }
              }
            }
          }
          gists {
            totalCount
          }
          status {
            message
            emojiHTML
          }
          twitterUsername
          websiteUrl
          company
          location
        }
      }
    `;

        // GitHub API limits contributionsCollection to 1 year max
        // So we need to fetch 2 separate years and combine them

        // First year: Today back to 1 year ago
        const year1To = new Date();
        const year1From = new Date();
        year1From.setFullYear(year1From.getFullYear() - 1);

        // Second year: 1 year ago back to 2 years ago
        const year2To = new Date(year1From);
        const year2From = new Date(year1From);
        year2From.setFullYear(year2From.getFullYear() - 1);

        logger.info(
            `Fetching GitHub contributions in 2 queries:\n` +
                `  Year 1: ${year1From.toISOString()} to ${year1To.toISOString()}\n` +
                `  Year 2: ${year2From.toISOString()} to ${year2To.toISOString()}`
        );

        // Fetch first year
        const graphqlResponse1 = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                variables: {
                    username,
                    from: year1From.toISOString(),
                    to: year1To.toISOString(),
                },
            }),
        });

        if (!graphqlResponse1.ok) {
            logger.error(
                `GitHub GraphQL API error (year 1): ${graphqlResponse1.status} ${graphqlResponse1.statusText}`
            );
            const errorText = await graphqlResponse1.text();
            logger.error(`GraphQL error response: ${errorText}`);
        }

        const graphqlData1 = await graphqlResponse1.json();

        // Check for GraphQL errors
        if (graphqlData1.errors) {
            logger.error(
                "GraphQL errors (year 1):",
                JSON.stringify(graphqlData1.errors)
            );
        }

        // Fetch second year
        const graphqlResponse2 = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                variables: {
                    username,
                    from: year2From.toISOString(),
                    to: year2To.toISOString(),
                },
            }),
        });

        if (!graphqlResponse2.ok) {
            logger.error(
                `GitHub GraphQL API error (year 2): ${graphqlResponse2.status} ${graphqlResponse2.statusText}`
            );
            const errorText = await graphqlResponse2.text();
            logger.error(`GraphQL error response: ${errorText}`);
        }

        const graphqlData2 = await graphqlResponse2.json();

        // Check for GraphQL errors
        if (graphqlData2.errors) {
            logger.error(
                "GraphQL errors (year 2):",
                JSON.stringify(graphqlData2.errors)
            );
        }

        // Combine the data from both years
        const userData1 = graphqlData1.data?.user;
        const userData2 = graphqlData2.data?.user;

        // Use year 1 data as base (most recent), we'll merge contribution data from year 2
        const userData = userData1;

        // Log if userData is missing
        if (!userData) {
            logger.warn(
                `No user data returned from GraphQL for username: ${username}`
            );
            logger.warn(
                `GraphQL response year 1: ${JSON.stringify(
                    graphqlData1
                ).substring(0, 500)}`
            );
            logger.warn(
                `GraphQL response year 2: ${JSON.stringify(
                    graphqlData2
                ).substring(0, 500)}`
            );
        }

        // Extract contribution data from both years
        const contributionCount1 =
            userData1?.contributionsCollection?.contributionCalendar
                ?.totalContributions || 0;
        const contributionCount2 =
            userData2?.contributionsCollection?.contributionCalendar
                ?.totalContributions || 0;
        const contributionCount = contributionCount1 + contributionCount2;

        // Log contribution data extraction
        logger.info(
            `Extracting contributions for ${username}: ${contributionCount} total (${contributionCount1} from year 1, ${contributionCount2} from year 2)`
        );

        const contributionDays: ContributionDay[] = [];

        // Process weekly contribution data
        const weeklyContributions: WeeklyContributions[] = [];

        // Extract all contribution days and organize by week from both years
        const weeks1 =
            userData1?.contributionsCollection?.contributionCalendar?.weeks ||
            [];
        const weeks2 =
            userData2?.contributionsCollection?.contributionCalendar?.weeks ||
            [];

        if (!weeks1 && !weeks2) {
            logger.warn(
                `No contribution weeks data found for ${username}. ContributionsCollection structure:`,
                JSON.stringify(
                    userData?.contributionsCollection || {}
                ).substring(0, 300)
            );
        }

        // Combine weeks from both years (year 2 first, then year 1 for chronological order)
        const allWeeks = [...weeks2, ...weeks1];

        if (allWeeks.length > 0) {
            logger.info(
                `Processing ${allWeeks.length} weeks of contributions (${weeks2.length} from year 2, ${weeks1.length} from year 1)`
            );
            allWeeks.forEach((week: any) => {
                const weekData: WeeklyContributions = {
                    week: week.firstDay,
                    count: 0,
                    days: [],
                };

                week.contributionDays.forEach((day: any) => {
                    const contributionDay = {
                        contributionCount: day.contributionCount,
                        date: day.date,
                    };

                    contributionDays.push(contributionDay);
                    weekData.days.push(contributionDay);
                    weekData.count += day.contributionCount;
                });

                weeklyContributions.push(weekData);
            });
        }

        logger.info(
            `Processed ${contributionDays.length} contribution days, ${weeklyContributions.length} weeks`
        );

        // Calculate contribution streak and active days
        let currentStreak = 0;
        let maxStreak = 0;
        let activeDays = 0;
        let tempStreak = 0;

        // Sort by date descending (most recent first)
        contributionDays.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        logger.info(
            `Calculating streaks from ${contributionDays.length} contribution days`
        );

        // Calculate current streak (consecutive days from today backwards)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Start from the most recent day and count backwards
        // Find the starting point for the streak (either today or yesterday)
        let streakDate = new Date(today);

        // If today has 0 contributions, start from yesterday
        if (contributionDays.length > 0) {
            const mostRecentDay = new Date(contributionDays[0].date);
            mostRecentDay.setHours(0, 0, 0, 0);

            // If the most recent day is today but has 0 contributions, start from yesterday
            if (
                mostRecentDay.getTime() === today.getTime() &&
                contributionDays[0].contributionCount === 0
            ) {
                streakDate.setDate(streakDate.getDate() - 1);
            }
        }

        // Count consecutive days with contributions going backwards from streakDate
        for (let i = 0; i < contributionDays.length; i++) {
            // Calculate expected date for current position
            const expectedDate = new Date(streakDate);
            expectedDate.setDate(streakDate.getDate() - i);

            // Compare date strings (YYYY-MM-DD) instead of timestamps to avoid timezone issues
            const expectedDateStr = expectedDate.toISOString().split("T")[0];
            const actualDateStr = contributionDays[i].date;

            // Count all days with contributions for activeDays
            if (contributionDays[i].contributionCount > 0) {
                activeDays++;
            }

            // For current streak: must be on expected consecutive day AND have contributions
            if (expectedDateStr === actualDateStr) {
                if (contributionDays[i].contributionCount > 0) {
                    currentStreak++;
                } else {
                    // Hit a day with no contributions - streak is broken
                    break;
                }
            } else {
                // Date doesn't match expected sequence - streak is broken
                break;
            }
        }

        // Calculate max streak by going through all days
        tempStreak = 0;
        for (let i = contributionDays.length - 1; i >= 0; i--) {
            if (contributionDays[i].contributionCount > 0) {
                tempStreak++;
                maxStreak = Math.max(maxStreak, tempStreak);
            } else {
                tempStreak = 0;
            }
        }

        logger.info(
            `Streaks calculated - Current: ${currentStreak}, Max: ${maxStreak}, Active days: ${activeDays}`
        );

        // Calculate language distribution percentage
        const languageDistribution: LanguageStats[] = Object.entries(
            languageCounts
        )
            .map(([language, data]) => ({
                language,
                count: data.count,
                percentage: Math.round((data.count / repos.length) * 100),
                projects: data.repos.length,
            }))
            .sort((a, b) => b.count - a.count);

        // Get original (non-forked) repos count
        const originalRepos = repos.filter((repo) => !repo.fork);

        // Calculate stars and forks received
        const starsReceived = repos.reduce(
            (total, repo) => total + (repo.stargazers_count || 0),
            0
        );
        const forksReceived = repos.reduce(
            (total, repo) => total + (repo.forks_count || 0),
            0
        );

        // Get most starred repositories
        const mostStarredRepos = [...repos]
            .sort(
                (a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)
            )
            .slice(0, 5)
            .map((repo) => ({
                name: repo.name,
                stars: repo.stargazers_count || 0,
                description: repo.description,
                url: repo.html_url,
                language: repo.language,
            }));

        // Calculate commits by repository
        const commitsByRepo =
            userData?.contributionsCollection
                ?.commitContributionsByRepository || [];
        const commitStats = commitsByRepo
            .map((item: any) => ({
                repository: item.repository.nameWithOwner,
                commits: item.contributions.totalCount,
                language: item.repository.primaryLanguage?.name,
            }))
            .sort((a: any, b: any) => b.commits - a.commits)
            .slice(0, 10);

        // Get pinned repositories
        const pinnedRepos =
            userData?.pinnedItems?.nodes?.map((item: any) => ({
                name: item.name,
                description: item.description,
                stars: item.stargazerCount,
                language: item.primaryLanguage?.name,
            })) || [];

        // Process organizations data
        const organizations =
            userData?.organizations?.nodes?.map((org: any) => ({
                login: org.login,
                name: org.name,
                avatarUrl: org.avatarUrl,
            })) || [];

        // Calculate activity patterns (most active days, hours)
        const dayOfWeekActivity = Array(7).fill(0);
        contributionDays.forEach((day) => {
            if (day && day.date) {
                const dayOfWeek = new Date(day.date).getDay();
                dayOfWeekActivity[dayOfWeek] += day.contributionCount;
            }
        });

        // Calculate active months
        const monthlyActivity: Record<string, number> = {};
        contributionDays.forEach((day) => {
            if (day && day.date && typeof day.date === "string") {
                const month = day.date.substring(0, 7); // YYYY-MM
                monthlyActivity[month] =
                    (monthlyActivity[month] || 0) + day.contributionCount;
            }
        });

        // Calculate average contributions per day
        const averageContributionsPerDay =
            contributionDays.length > 0
                ? contributionCount / Math.min(contributionDays.length, 365)
                : 0;

        // Find most productive day
        const mostProductiveDay =
            contributionDays.length > 0
                ? [...contributionDays].sort(
                      (a, b) => b.contributionCount - a.contributionCount
                  )[0]
                : null;

        // Construct the response data
        const profileData = {
            username: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
            bio: user.bio,

            // Additional profile information
            email: user.email,
            location: user.location || userData?.location,
            company: user.company || userData?.company,
            blog: user.blog || userData?.websiteUrl,
            twitterUsername: user.twitter_username || userData?.twitterUsername,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            status: userData?.status?.message,

            // Activity Metrics
            contributionCount,
            currentStreak,
            maxStreak,
            activeDaysPerWeek:
                Math.round((activeDays / (contributionDays.length / 7)) * 10) /
                10,
            averageContributionsPerDay:
                Math.round(averageContributionsPerDay * 10) / 10,
            mostProductiveDay: mostProductiveDay
                ? {
                      date: mostProductiveDay.date,
                      contributions: mostProductiveDay.contributionCount,
                  }
                : null,
            weeklyContributions: weeklyContributions, // All weeks from the past year
            dayOfWeekActivity,
            monthlyActivity: Object.entries(monthlyActivity)
                .map(([month, count]) => ({ month, count }))
                .sort((a, b) => b.count - a.count),

            // Repository Statistics
            repoCount: user.public_repos,
            originalRepoCount: originalRepos.length,
            starsReceived,
            forksReceived,
            mostStarredRepos,
            pinnedRepos,
            gistsCount: userData?.gists?.totalCount || 0,
            commitsByRepository: commitStats,

            // Technical Profile
            topLanguages,
            languageDistribution,

            // Collaboration & Social
            followers: user.followers,
            following: userData?.following?.totalCount || 0,
            organizationsCount: userData?.organizations?.totalCount || 0,
            organizations,
            contributedToCount:
                userData?.repositoriesContributedTo?.totalCount || 0,
            pullRequestsCount: userData?.pullRequests?.totalCount || 0,
            issuesCount: userData?.issues?.totalCount || 0,
            starredReposCount: userData?.starredRepositories?.totalCount || 0,

            // Metadata
            lastUpdated: new Date().toISOString(),
        };

        // Save profile to database if requested
        if (saveProfile) {
            try {
                const db = getFirestore();
                const cleanProfileData = JSON.parse(
                    JSON.stringify(profileData)
                );

                logger.info(
                    `Saving GitHub profile for ${username}: ${cleanProfileData.contributionCount} contributions, ${cleanProfileData.repoCount} repos`
                );

                // Get current profile data to calculate complete profile score
                const currentProfile = await db
                    .collection("profiles")
                    .doc(uid)
                    .get();
                const currentData = currentProfile.exists
                    ? currentProfile.data()
                    : {};

                // Merge with new GitHub data
                const updatedProfileData = {
                    ...currentData,
                    github: cleanProfileData,
                    githubUsername: profileData.username,
                };

                // Calculate profile score
                const profileScore = calculateProfileScore(updatedProfileData);

                await db.collection("profiles").doc(uid).set(
                    {
                        github: cleanProfileData,
                        githubUsername: profileData.username,
                        profileScore: profileScore,
                        updatedAt: new Date(),
                    },
                    { merge: true }
                );
                logger.info(
                    `Successfully saved GitHub profile for user: ${user.login}, profile score: ${profileScore.score}%`
                );
            } catch (dbError) {
                logger.error("Error saving profile to database:", dbError);
                // Continue execution to return profile even if save fails
            }
        }

        logger.info(
            `Returning GitHub profile for ${username} with ${profileData.contributionCount} contributions`
        );

        return res.json(profileData);
    } catch (error) {
        logger.error("GitHub API error:", error);
        return res.status(500).json({ error: "Failed to fetch GitHub data" });
    }
});

// DELETE /github/delete - Delete GitHub profile from database
router.delete("/delete", async (req, res) => {
    try {
        const uid = req.user?.uid;

        if (!uid) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized - Missing user ID",
            });
        }

        const db = getFirestore();

        // Remove the github field from the profile using FieldValue.delete()

        // Get current profile data to recalculate profile score
        const currentProfile = await db.collection("profiles").doc(uid).get();
        const currentData = currentProfile.exists ? currentProfile.data() : {};

        // Merge with removed GitHub data
        const updatedProfileData = {
            ...currentData,
            github: undefined,
            githubUsername: undefined,
        };

        // Calculate updated profile score
        const profileScore = calculateProfileScore(updatedProfileData);

        await db.collection("profiles").doc(uid).update({
            github: FieldValue.delete(),
            githubUsername: FieldValue.delete(),
            profileScore: profileScore,
            updatedAt: new Date(),
        });

        logger.info(
            `Deleted GitHub profile for user: ${uid}, profile score: ${profileScore.score}%`
        );

        return res.json({
            success: true,
            message: "GitHub profile deleted successfully",
        });
    } catch (error) {
        logger.error("Error deleting GitHub profile:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to delete GitHub profile",
        });
    }
});

export default router;

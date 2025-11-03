import express from "express";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

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

        if (!uid) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized - Missing user ID",
            });
        }

        if (!githubToken) {
            return res.status(401).json({
                error: "GitHub token is required in the request body",
            });
        }

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
            return res
                .status(authUserResponse.status)
                .json({ error: "Failed to authenticate with GitHub token" });
        }

        const authUser = await authUserResponse.json();
        const username = authUser.login;

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
        const query = `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
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

        const graphqlResponse = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query, variables: { username } }),
        });

        const graphqlData = await graphqlResponse.json();
        const userData = graphqlData.data?.user;

        // Extract contribution data
        const contributionCount =
            userData?.contributionsCollection?.contributionCalendar
                ?.totalContributions || 0;
        const contributionDays: ContributionDay[] = [];

        // Process weekly contribution data
        const weeklyContributions: WeeklyContributions[] = [];

        // Extract all contribution days and organize by week
        if (userData?.contributionsCollection?.contributionCalendar?.weeks) {
            userData.contributionsCollection.contributionCalendar.weeks.forEach(
                (week: any) => {
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
                }
            );
        }

        // Calculate contribution streak and active days
        let currentStreak = 0;
        let maxStreak = 0;
        let activeDays = 0;

        // Sort by date descending
        contributionDays.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        for (let i = 0; i < contributionDays.length; i++) {
            if (contributionDays[i].contributionCount > 0) {
                activeDays++;
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

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
            const dayOfWeek = new Date(day.date).getDay();
            dayOfWeekActivity[dayOfWeek] += day.contributionCount;
        });

        // Calculate active months
        const monthlyActivity: Record<string, number> = {};
        contributionDays.forEach((day) => {
            const month = day.date.substring(0, 7); // YYYY-MM
            monthlyActivity[month] =
                (monthlyActivity[month] || 0) + day.contributionCount;
        });

        // Calculate average contributions per day
        const averageContributionsPerDay =
            contributionCount / Math.min(contributionDays.length, 365);

        // Find most productive day
        const mostProductiveDay = [...contributionDays].sort(
            (a, b) => b.contributionCount - a.contributionCount
        )[0];

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
            weeklyContributions: weeklyContributions.slice(0, 10), // Last 10 weeks
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
                await db.collection("profiles").doc(uid).set(
                    {
                        github: cleanProfileData,
                        githubUsername: profileData.username,
                    },
                    { merge: true }
                );
                logger.info(`Saved GitHub profile for user: ${user.login}`);
            } catch (dbError) {
                logger.error("Error saving profile to database:", dbError);
                // Continue execution to return profile even if save fails
            }
        }

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
        const { FieldValue } = await import("firebase-admin/firestore");

        await db.collection("profiles").doc(uid).update({
            github: FieldValue.delete(),
        });

        logger.info(`Deleted GitHub profile for user: ${uid}`);

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

import { apiFetch } from "./fetch";

export interface GithubProfile {
  username: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
  email: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  twitterUsername: string | null;
  createdAt: string;
  updatedAt: string;
  followers: number;
  following: number;

  // Activity Metrics
  contributionCount: number;
  currentStreak: number;
  maxStreak: number;
  activeDaysPerWeek: number;
  averageContributionsPerDay: number;
  mostProductiveDay: {
    date: string;
    contributions: number;
  };
  weeklyContributions: Array<{
    week: string;
    count: number;
    days: Array<{
      contributionCount: number;
      date: string;
    }>;
  }>;
  dayOfWeekActivity: number[];
  monthlyActivity: Array<{
    month: string;
    count: number;
  }>;

  // Repository Statistics
  repoCount: number;
  originalRepoCount: number;
  starsReceived: number;
  forksReceived: number;
  mostStarredRepos: Array<{
    name: string;
    stars: number;
    description: string | null;
    url: string;
    language: string;
  }>;
  pinnedRepos: any[]; // Type can be refined based on actual structure
  gistsCount: number;
  commitsByRepository: Array<{
    repository: string;
    commits: number;
    language?: string;
  }>;
  pullRequestsCount: number;
  issuesCount: number;
  starredReposCount: number;

  // Technical Profile
  topLanguages: string[];
  languageDistribution: Array<{
    language: string;
    count: number;
    percentage: number;
    projects: number;
  }>;

  // Collaboration & Social
  organizationsCount: number;
  organizations: Array<{
    login: string;
    name: string;
    avatarUrl: string;
  }>;
  contributedToCount: number;
}

export async function fetchGithubUserProfile(
  githubToken?: string
): Promise<GithubProfile> {
  if (!githubToken) {
    throw new Error("GitHub token is required");
  }

  const response = await apiFetch(`/github/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ githubToken }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${response.status}`);
  }

  return await response.json();
}

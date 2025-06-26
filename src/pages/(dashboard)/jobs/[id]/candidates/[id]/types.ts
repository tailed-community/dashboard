export interface CandidateData {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  status: string;
  appliedAt: string;
  updatedAt: string;
  initials: string;
  university: string | null;
  major: string | null;
  graduationYear: string | null;
  githubUsername: string | null;
  devpostUsername: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  resume: string | null;
  jobId: string;
  profileId: string | null;
  profileData: {
    github?: {
      username: string;
      name: string;
      bio: string;
      avatarUrl: string;
      location?: string;
      followers: number;
      following: number;
      repoCount: number;
      contributionCount: number;
      currentStreak: number;
      maxStreak: number;
      topLanguages: string[];
      languageDistribution?: Array<{
        language: string;
        percentage: number;
        projects: number;
      }>;
      weeklyContributions?: Array<{
        count: number;
        days?: Array<{
          date: string;
          contributionCount: number;
        }>;
      }>;
      mostProductiveDay?: {
        date: string;
        contributions: number;
      };
      averageContributionsPerDay: number;
      activeDaysPerWeek: number;
      pullRequestsCount: number;
      mostStarredRepos: Array<{
        name: string;
        url: string;
        stars: number;
      }>;
    };
    devpost?: {
      username: string;
      name: string;
      bio: string;
      location: string;
      image: string;
      skills: string[];
      interests: string[];
      stats: {
        projectCount: number;
        hackathonCount: number;
        winCount: number;
        likedProjectsCount: number;
      };
      achievements: {
        totalWins: number;
        firstPlaceWins: number;
        categoryPrizes: number;
      };
      projectsAndHackathons: Array<{
        project: string;
        project_link: string;
        github_link: string;
        hackathon: string;
        hackathon_link: string;
        win: string;
        year: number | null;
        technologies: string[];
        description: string;
      }>;
    };
    basicInfo?: {
      // Add any basic info fields that might be present
    };
  } | null;
  job?: {
    id: string;
    title: string;
    type: string;
    location: string;
  };
}

export interface CandidateReviewData {
  id: string;
  applicantId: string;
  reviewerId: string;
  rating: number;
  notes: string;
  status: "Pending" | "Shortlisted" | "Rejected" | "Interviewed";
  createdAt: string;
  updatedAt: string;
}

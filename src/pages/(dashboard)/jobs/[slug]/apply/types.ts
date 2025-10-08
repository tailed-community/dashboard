export interface TokenInfo {
    token: {
        id: string;
        createdAt: string;
        expires: string;
    };
    applicant: {
        id: string;
        email: string;
        status: "Sent" | "Opened" | "Completed";
        firstName: string | null;
        lastName: string | null;
    };
    job: {
        id: string;
        title: string;
        type: string;
        location: string;
        description: string | null;
    };
    organization: {
        id: string;
        name: string;
        logo: string | null;
    };
}

// Define job data type based on API response
export type JobData = {
    job: {
        id: string;
        title: string;
        type: string;
        location: string;
        description: string;
        requirements: string;
        postingDate: string;
        endPostingDate: string;
        status: string;
    };
    organization: {
        id: string;
        name: string;
        logo: string | null;
    };
};

export interface ApplicationFormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    university: string;
    major: string;
    graduationYear: string;
    githubUsername: string;
    devpostUsername: string;
    linkedinUrl: string;
    portfolioUrl: string;
    coverLetter: string;
    resume: {
        id: string;
        name: string;
        url: string;
        uploadedAt: {
            _seconds: number;
            _nanoseconds: number;
        };
    };
}

export interface DevpostProfile {
    username: string;
    name: string;
    links: any;
    bio: string;
    location: string;
    image: string;
    skills: string[];
    interests: string[];
    followers: number;
    following: number;
    stats: {
        projectCount: number;
        hackathonCount: number;
        winCount: number;
        likedProjectsCount: number;
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
        members: string[];
        built_with: string[];
        detailed_technologies: string[];
        images: string[];
        video: string;
        likes: number;
        prizes: any[];
        hackathon_details: {
            description: string;
            deadline: string;
            participants: string;
            prizes: any[];
            sponsors: any[];
        } | null;
    }>;
    projects: {
        all: any[];
        winning: any[];
    };
    hackathons: {
        all: any[];
        enriched: Array<{
            id: string;
            name?: string;
            description?: string;
            deadline?: string;
            participants?: string;
            prizes?: any[];
            sponsors?: any[];
        }>;
        participationByYear: Record<string, number>;
    };
    achievements: {
        totalWins: number;
        firstPlaceWins: number;
        categoryPrizes: number;
        badges: any[];
    };
}

import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/fetch";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";
import JobDetails from "@/pages/(dashboard)/jobs/[id]/job-details";

interface ApplicantStats {
  totalApplicants: number;
  statusDistribution: {
    [key: string]: number;
  };
  githubStats: {
    averageContributions: number;
    maxContributions: number;
    topLanguages: Array<{ language: string; count: number }>;
    contributionDistribution: {
      [key: string]: number;
    };
  };
  devpostStats: {
    averageHackathons: number;
    averageWins: number;
    participationRate: number;
    topTechnologies: Array<{ technology: string; count: number }>;
  };
  educationStats: {
    universities: Array<{ name: string; count: number }>;
    majors: Array<{ name: string; count: number }>;
    graduationYears: Array<{ year: string; count: number }>;
  };
  applicationTimeline: Array<{ date: string; count: number }>;
  topPerformers: Array<{
    id: string;
    name: string;
    email: string;
    score: number;
    githubContributions?: number;
    hackathonCount?: number;
    winCount?: number;
  }>;
}

interface Job {
  id: string;
  title: string;
  type: string;
  location: string;
  status: "Active" | "Draft";
  applicants: number;
  applicantStats?: ApplicantStats;
}

export default function Page() {
  const { id: jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiFetch(`/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job");
        }
        const data = await response.json();

        // Fetch statistics separately
        try {
          const statsResponse = await apiFetch(`/jobs/${jobId}/statistics`);
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            data.applicantStats = statsData;
          }
        } catch (statsError) {
          console.error("Error fetching statistics:", statsError);
        }

        setJob(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchJob();
  }, [jobId]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/jobs">Jobs</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {isLoading ? "Loading..." : (job?.title ?? "Error")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
          {isLoading && <div>Loading...</div>}
          {error && <div>Failed to load job</div>}
          {job && <JobDetails job={job} />}
        </div>
      </div>
    </>
  );
}

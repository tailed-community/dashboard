import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch";
import { Building2 } from "lucide-react";
import ExternalJobPreview from "./external-job-preview";

// Skeleton component for loading state
function JobCardSkeleton() {
  return (
    <Card className="animate-pulse cursor-default">
      <CardContent className="flex gap-4 items-center p-6">
        <div className="w-12 h-12 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
          <div className="h-2 w-1/4 bg-muted rounded" />
        </div>
        <div className="h-6 w-16 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}

type Job = {
  id: string;
  title: string;
  type: string;
  location: string;
  postingDate: string;
  endPostingDate: string;
  status: string;
  organization: {
    id: string;
    name: string;
    logo: string | null;
  };
};

export default function JobBoard() {
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobsRes, appliedJobsRes] = await Promise.all([
        apiFetch("/public/jobs", {}, true),
        apiFetch("/job/applied-jobs"),
      ]);

      const jobs = await jobsRes.json();
      setFeaturedJobs(jobs.jobs);

      const appliedJobsData = await appliedJobsRes.json();
      if (Array.isArray(appliedJobsData)) {
        setAppliedJobIds(new Set(appliedJobsData));
      }
    } catch (e) {
      setFeaturedJobs([]);
      setAppliedJobIds(new Set());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="mt-8">
      {loading ? (
        <ul className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <JobCardSkeleton />
            </li>
          ))}
        </ul>
      ) : featuredJobs.length === 0 ? (
        <div className="text-muted-foreground">No featured jobs found.</div>
      ) : (
        <>
          <h2 className="font-semibold mb-4">Featured Jobs</h2>
          <ul className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {featuredJobs.map((job) => (
              <li key={job.id} className="lg:col-span-4">
                <Card
                  className="transition-all cursor-pointer group"
                  onClick={() => navigate(`/jobs/${job.id}/`)}
                  tabIndex={0}
                  aria-label={`View job: ${job.title}`}
                >
                  <CardContent className="flex gap-6 items-center ">
                    {/* Logo with luxury border and shadow */}
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-muted flex items-center justify-center rounded-md">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    </div>
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors truncate">
                          {job.title}
                        </span>
                        {appliedJobIds.has(job.id) && (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-600"
                          >
                            Applied
                          </Badge>
                        )}
                      </div>

                      <span className="font-medium text-gray-700">
                        {job.organization.name}
                      </span>
                      <div className="flex gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className="text-gray-700 capitalize"
                        >
                          {job.type}
                        </Badge>
                        <Badge variant="secondary" className="text-gray-700">
                          {job.location}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-12">
        <h3 className="font-semibold mb-4">Explore more job opportunities</h3>
        <ExternalJobPreview limit={6} />
        <div className="mt-4 text-center">
          <a
            href="/jobs/external"
            className="text-primary hover:underline font-medium"
          >
            View all opportunities →
          </a>
        </div>
      </div>
    </div>
  );
}

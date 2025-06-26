import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { m } from "@/paraglide/messages.js";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch";

interface Job {
  id: string;
  title: string;
  type: string;
  location: string;
  status: "Active" | "Draft";
  applicants: number;
}

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await apiFetch("/jobs");
        const data = await response.json();
        setJobs(data);
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  if (loading) {
    return <div className="w-full p-4">{m.loading_jobs()}</div>;
  }

  return (
    <div className="w-full p-4 grid gap-4">
      <Link to={"/jobs/new"}>
        <Card className="border-dashed hover:border-primary/50 cursor-pointer transition-colors">
          <CardContent className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {m.create_a_new_job()}
            </div>
          </CardContent>
        </Card>
      </Link>

      {jobs?.map((job, index) => (
        <Link key={index} to={`/jobs/${job.id}`} className="block">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <h3 className="font-semibold">{job.title}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{job.type}</span>
                    <span>•</span>
                    <span>{job.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    variant={job.status === "Active" ? "default" : "secondary"}
                  >
                    {job.status}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {job.applicants}{" "}
                    {job.applicants === 1 ? "Applicant" : "Applicants"}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

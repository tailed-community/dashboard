import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import {
  Loader2,
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Job } from "@/types/jobs";

export default function PublicJobPage() {
  const { slug } = useParams<{ slug: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(`/jobs/public/${slug}`, {}, true);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load job");
        }

        const data = await response.json();
        setJob(data);
      } catch (err) {
        console.error("Error loading job:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-muted-foreground">Loading job...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-destructive">Error</h1>
          <p className="mt-2 text-muted-foreground">
            {error || "This job posting is not available or has expired."}
          </p>
          <Button className="mt-4" asChild>
            <Link to="/dashboard">Return to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/dashboard"
          className="mb-6 flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to home
        </Link>

        <Card className="border shadow-md">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{job.title}</CardTitle>
                <CardDescription className="mt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center text-muted-foreground">
                      <Briefcase className="mr-1 h-4 w-4" />
                      <span>{job.type}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <MapPin className="mr-1 h-4 w-4" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="mr-1 h-4 w-4" />
                      <span>Posted {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardDescription>
              </div>

              <Badge
                variant={job.status === "Active" ? "default" : "secondary"}
              >
                {job.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {job.description && (
              <div>
                <h2 className="mb-2 font-semibold">Description</h2>
                <div className="whitespace-pre-line text-muted-foreground">
                  {job.description}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button className="w-full" asChild>
              <Link
                to={`/public/jobs/${job.id}`}
                className="flex items-center justify-center gap-2"
              >
                Apply for this position
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

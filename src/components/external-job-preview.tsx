import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type ExternalJob } from "@/types/jobs";
import { Building2, MapPin, Calendar, ExternalLink } from "lucide-react";

const INTERNSHIPS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-internships-2025-2026/refs/heads/main/data/current.json";
const NEW_GRADS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-new-grads-2025-2026/refs/heads/main/data/current.json";

interface ExternalJobPreviewProps {
  limit?: number;
}

export default function ExternalJobPreview({
  limit = 10,
}: ExternalJobPreviewProps) {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const [internshipsRes, newGradsRes] = await Promise.all([
          fetch(INTERNSHIPS_URL),
          fetch(NEW_GRADS_URL),
        ]);

        const internships: Omit<ExternalJob, "type">[] =
          await internshipsRes.json();
        const newGrads: Omit<ExternalJob, "type">[] = await newGradsRes.json();

        // Add type indicator and combine
        const allJobs: ExternalJob[] = [
          ...internships.map((job) => ({
            ...job,
            type: "internship" as const,
          })),
          ...newGrads.map((job) => ({ ...job, type: "new-grad" as const })),
        ];

        // Sort by date_posted descending and take first limit
        const sortedJobs = allJobs
          .sort((a, b) => b.date_posted - a.date_posted)
          .slice(0, limit);

        setJobs(sortedJobs);
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [limit]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-6 bg-muted rounded mb-4"></div>
              <div className="h-3 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {jobs.map((job) => (
        <Card key={job.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">{job.company_name}</CardTitle>
              </div>
              <Badge
                variant={job.type === "internship" ? "secondary" : "default"}
              >
                {job.type === "internship" ? "Internship" : "New Grad"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold mb-2">{job.title}</h3>
            {job.category && (
              <Badge variant="outline" className="mb-2">
                {job.category}
              </Badge>
            )}
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{job.locations.join(", ")}</span>
              </div>
              {job.terms && job.terms.length > 0 && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{job.terms.join(", ")}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>Degrees: {job.degrees.join(", ")}</span>
              </div>
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-primary hover:underline"
            >
              Apply Now <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

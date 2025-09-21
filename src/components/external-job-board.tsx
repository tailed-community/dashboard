import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ExternalJob } from "@/types/jobs";
import { Building2, MapPin, Calendar, ExternalLink } from "lucide-react";

const INTERNSHIPS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-internships-2025-2026/refs/heads/main/data/current.json";
const NEW_GRADS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-new-grads-2025-2026/refs/heads/main/data/current.json";

export default function ExternalJobBoard() {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const [internshipsRes, newGradsRes] = await Promise.all([
          fetch(INTERNSHIPS_URL),
          fetch(NEW_GRADS_URL),
        ]);

        const internships: ExternalJob[] = await internshipsRes.json();
        const newGrads: ExternalJob[] = await newGradsRes.json();

        // Add type indicator
        const allJobs = [
          ...internships.map((job) => ({
            ...job,
            type: "internship" as const,
          })),
          ...newGrads.map((job) => ({ ...job, type: "new-grad" as const })),
        ];

        setJobs(allJobs);
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    jobs.forEach((job) => {
      if (job.category) cats.add(job.category);
    });
    return Array.from(cats).sort();
  }, [jobs]);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    jobs.forEach((job) => {
      job.locations.forEach((loc) => locs.add(loc));
    });
    return Array.from(locs).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || job.category === selectedCategory;
      const matchesLocation =
        selectedLocation === "all" || job.locations.includes(selectedLocation);
      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [jobs, searchTerm, selectedCategory, selectedLocation]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Job Opportunities</h1>
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search by company or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.map((job) => (
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

      {filteredJobs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No jobs found matching your criteria.
          </p>
        </div>
      )}
    </div>
  );
}

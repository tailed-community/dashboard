import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { apiFetch } from "@/lib/fetch";
import { type ExternalJob } from "@/types/jobs";
import { Building2, MapPin, Calendar, ExternalLink, Star } from "lucide-react";

const INTERNSHIPS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-internships-2025-2026/refs/heads/main/data/current.json";
const NEW_GRADS_URL =
  "https://raw.githubusercontent.com/tailed-community/tech-new-grads-2025-2026/refs/heads/main/data/current.json";

type FeaturedJob = {
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
  featured: true;
};

type UnifiedJob = FeaturedJob | (ExternalJob & { featured: false });

interface UnifiedJobBoardProps {
  limit?: number;
}

type ParsedLocation = {
  city?: string;
  state?: string;
  country: string;
};

function parseLocation(location: string): ParsedLocation {
  const parts = location.split(",").map((p) => p.trim());
  if (parts.length === 3) {
    return { city: parts[0], state: parts[1], country: parts[2] };
  } else if (parts.length === 2) {
    // If only one comma, assume city, state and country is USA
    return { city: parts[0], state: parts[1], country: "USA" };
  } else {
    return { state: parts[0], country: "USA" };
  }
}

export default function UnifiedJobBoard({ limit }: UnifiedJobBoardProps) {
  const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([]);
  const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [parsedLocations, setParsedLocations] = useState<ParsedLocation[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const currentObservedRef = useRef<Element | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.5 }
    );
    observerRef.current = observer;

    return () => observer.disconnect();
  }, []);

  const setLastItemRef = (el: HTMLDivElement | null) => {
    if (currentObservedRef.current) {
      observerRef.current?.unobserve(currentObservedRef.current);
    }
    currentObservedRef.current = el;
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        apiFetch("/public/jobs", {}, true),
        apiFetch("/job/applied-jobs"),
        fetch(INTERNSHIPS_URL),
        fetch(NEW_GRADS_URL),
      ]);

      const [jobsResult, appliedJobsResult, internshipsResult, newGradsResult] =
        results;

      let featuredJobsData: FeaturedJob[] = [];
      if (jobsResult.status === "fulfilled") {
        const jobs = await jobsResult.value.json();
        featuredJobsData = jobs.jobs.map((job: any) => ({
          ...job,
          featured: true,
        }));
      } else {
        console.error("Failed to fetch featured jobs:", jobsResult.reason);
      }

      let appliedJobIdsData = new Set<string>();
      if (appliedJobsResult.status === "fulfilled") {
        const appliedJobsData = await appliedJobsResult.value.json();
        if (Array.isArray(appliedJobsData)) {
          appliedJobIdsData = new Set(appliedJobsData);
        }
      } else {
        console.error(
          "Failed to fetch applied jobs:",
          appliedJobsResult.reason
        );
      }

      let externalJobsData: ExternalJob[] = [];
      if (internshipsResult.status === "fulfilled") {
        const internships: ExternalJob[] = await internshipsResult.value.json();
        externalJobsData.push(
          ...internships.map((job) => ({ ...job, type: "internship" as const }))
        );
      } else {
        console.error("Failed to fetch internships:", internshipsResult.reason);
      }

      if (newGradsResult.status === "fulfilled") {
        const newGrads: ExternalJob[] = await newGradsResult.value.json();
        externalJobsData.push(
          ...newGrads.map((job) => ({ ...job, type: "new-grad" as const }))
        );
      } else {
        console.error("Failed to fetch new grads:", newGradsResult.reason);
      }

      setFeaturedJobs(featuredJobsData);
      setAppliedJobIds(appliedJobIdsData);
      setExternalJobs(externalJobsData);

      // Precompute categories and locations
      const allJobsTemp = [
        ...featuredJobsData,
        ...externalJobsData.map((job) => ({
          ...job,
          featured: false as const,
        })),
      ];
      const cats = new Set<string>();
      const locs = new Set<ParsedLocation>();
      allJobsTemp.forEach((job) => {
        if ("category" in job && job.category) cats.add(job.category);
        if ("locations" in job) {
          job.locations.forEach((loc) => {
            if (loc.trim() !== "") locs.add(parseLocation(loc));
          });
        } else if ("location" in job && job.location.trim() !== "") {
          locs.add(parseLocation(job.location));
        }
      });
      setCategories(
        Array.from(cats)
          .filter((cat) => cat.trim() !== "")
          .sort()
      );
      setParsedLocations(
        Array.from(locs)
          .filter((loc) => loc.country.trim() !== "")
          .sort((a, b) => a.country.localeCompare(b.country))
      );
    } catch (e) {
      console.log("Unexpected error in fetchData:", e);
      setFeaturedJobs([]);
      setAppliedJobIds(new Set());
      setExternalJobs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const allJobs: UnifiedJob[] = useMemo(() => {
    const combined = [
      ...featuredJobs,
      ...externalJobs.map((job) => ({ ...job, featured: false as const })),
    ];
    // Sort by featured first, then by date (for external, date_posted desc, for featured, assume recent)
    return combined.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      if (!a.featured && !b.featured) {
        return (b as ExternalJob).date_posted - (a as ExternalJob).date_posted;
      }
      return 0;
    });
  }, [featuredJobs, externalJobs]);

  const types = ["internship", "new-grad", "featured"];

  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    parsedLocations.forEach((loc) => countries.add(loc.country));
    return Array.from(countries).sort();
  }, [parsedLocations]);

  const availableStates = useMemo(() => {
    if (selectedCountry === "all") return [];
    const states = new Set<string>();
    parsedLocations
      .filter(
        (loc) =>
          loc.country === selectedCountry &&
          loc.state &&
          loc.state.trim() !== ""
      )
      .forEach((loc) => states.add(loc.state!));
    return Array.from(states).sort();
  }, [parsedLocations, selectedCountry]);

  const availableCities = useMemo(() => {
    if (selectedCountry === "all") return [];
    const cities = new Set<string>();
    parsedLocations
      .filter((loc) => {
        if (loc.country !== selectedCountry) return false;
        if (selectedState !== "all" && loc.state !== selectedState)
          return false;
        return loc.city && loc.city.trim() !== "";
      })
      .forEach((loc) => cities.add(loc.city!));
    return Array.from(cities).sort();
  }, [parsedLocations, selectedCountry, selectedState]);

  const matchesLocation = (job: UnifiedJob): boolean => {
    if (selectedCountry === "all") return true;
    const jobLocations = "locations" in job ? job.locations : [job.location];
    return jobLocations.some((locStr) => {
      const parsed = parseLocation(locStr);
      if (parsed.country !== selectedCountry) return false;
      if (selectedState !== "all" && parsed.state !== selectedState)
        return false;
      if (selectedCity !== "all" && parsed.city !== selectedCity) return false;
      return true;
    });
  };

  const getSearchableText = (job: UnifiedJob): string => {
    const fields: string[] = [];
    fields.push(job.title);
    if (job.featured) {
      fields.push(job.organization.name);
      fields.push(job.location);
      fields.push(job.type);
    } else {
      fields.push(job.company_name);
      fields.push(...job.locations);
      if (job.category) fields.push(job.category);
      if (job.terms) fields.push(...job.terms);
      if (job.degrees) fields.push(...job.degrees);
    }
    return fields.join(" ").toLowerCase();
  };

  const filteredJobs = useMemo(() => {
    let filtered = allJobs.filter((job) => {
      const searchableText = getSearchableText(job);
      const regex = searchTerm ? new RegExp(searchTerm, "i") : null;
      const matchesSearch = !regex || regex.test(searchableText);
      const matchesCategory =
        selectedCategory === "all" ||
        ("category" in job && job.category === selectedCategory);
      const matchesLocationFilter = matchesLocation(job);
      const jobType = job.featured ? "featured" : job.type;
      const matchesType = selectedType === "all" || jobType === selectedType;
      return (
        matchesSearch && matchesCategory && matchesLocationFilter && matchesType
      );
    });
    if (limit) filtered = filtered.slice(0, limit);
    return filtered;
  }, [
    allJobs,
    searchTerm,
    selectedCategory,
    selectedCountry,
    selectedState,
    selectedCity,
    selectedType,
    limit,
  ]);

  useEffect(() => {
    setVisibleCount(20);
  }, [filteredJobs]);

  const handleJobClick = (job: UnifiedJob) => {
    if (job.featured) {
      navigate(`/jobs/${job.id}/`);
    } else {
      window.open(job.url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col gap-6">
          {Array.from({ length: limit || 6 }).map((_, i) => (
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
            placeholder="Search all fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type === "new-grad"
                    ? "New Grad"
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            value={selectedCountry}
            onValueChange={(value) => {
              setSelectedCountry(value);
              setSelectedState("all");
              setSelectedCity("all");
            }}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {availableCountries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCountry !== "all" && availableStates.length > 0 && (
            <Select
              value={selectedState}
              onValueChange={(value) => {
                setSelectedState(value);
                setSelectedCity("all");
              }}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {availableStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedState !== "all" && availableCities.length > 0 && (
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-muted-foreground">
          Showing {filteredJobs.length} opportunities
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {filteredJobs.slice(0, visibleCount).map((job, index) => (
          <Card
            key={job.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleJobClick(job)}
            ref={index === visibleCount - 1 ? setLastItemRef : undefined}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">
                    {job.featured ? job.organization.name : job.company_name}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  {job.featured && (
                    <Badge variant="default">
                      <Star className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                  <Badge
                    variant={
                      job.type === "internship" ? "secondary" : "default"
                    }
                  >
                    {job.type === "internship" ? "Internship" : "New Grad"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold mb-2">{job.title}</h3>
              {"category" in job && job.category && (
                <Badge variant="outline" className="mb-2">
                  {job.category}
                </Badge>
              )}
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {"locations" in job
                      ? job.locations.join(", ")
                      : job.location}
                  </span>
                </div>
                {"terms" in job && job.terms && job.terms.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{job.terms.join(", ")}</span>
                  </div>
                )}
                {"degrees" in job && job.degrees && job.degrees.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span>Degrees: {job.degrees.join(", ")}</span>
                  </div>
                )}
              </div>
              {job.featured && appliedJobIds.has(job.id) && (
                <Badge
                  variant="outline"
                  className="mt-4 text-green-600 border-green-600"
                >
                  Applied
                </Badge>
              )}
              {!job.featured && (
                <div className="mt-4 text-primary text-sm">
                  Apply externally <ExternalLink className="h-4 w-4 inline" />
                </div>
              )}
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

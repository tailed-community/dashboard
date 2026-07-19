import { useEffect, useState, useMemo, useRef, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchExternalJobs } from "@/lib/external-jobs";
import { apiFetch } from "@/lib/fetch";
import { type ExternalJob } from "@/types/jobs";
import {
    buildFilterIndex,
    formatLocationForDisplay,
    matchLocationFilters,
    normalizeLocations,
    normalizeSearchText,
    type NormalizedJobLocation,
} from "@/lib/location-normalization";
import { Building2, MapPin, Calendar, ExternalLink, Star, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedJobs } from "@/lib/saved-jobs";
import { JobAlertSignup, isJobAlertSubscribed } from "@/components/capture/job-alert-signup";
import { FloatingCaptureCard } from "@/components/capture/floating-capture-card";
import { trackEvent } from "@/lib/analytics";
import { getStorageFlag, setStorageFlag } from "@/lib/storage-flags";

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
    variant?: "full" | "preview";
}

export function UnifiedJobBoard({ limit, variant = "full" }: UnifiedJobBoardProps) {
    const isPreview = variant === "preview";
    const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([]);
    const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(
        () => searchParams.get("search") || ""
    );
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string>("all");
    const [selectedState, setSelectedState] = useState<string>("all");
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedWorkModes, setSelectedWorkModes] = useState<Array<"onsite" | "hybrid" | "remote">>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(20);
    const [showSavedOnly, setShowSavedOnly] = useState(false);
    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const currentObservedRef = useRef<Element | null>(null);
    const navigate = useNavigate();
    const { savedIds, isSaved, toggleSaved } = useSavedJobs();

    useEffect(() => {
        if (!isPreview) trackEvent("jobs_view");
    }, [isPreview]);

    const handleToggleSaved = (e: React.MouseEvent, jobId: string) => {
        e.stopPropagation();
        const { saved, count } = toggleSaved(jobId);
        if (!saved) return;

        trackEvent("job_saved", { jobId });

        if (count === 2 && !isJobAlertSubscribed()) {
            const promptAlreadyShown = getStorageFlag("local", "saveJobPromptShown");
            if (!promptAlreadyShown) {
                setShowSavePrompt(true);
                setStorageFlag("local", "saveJobPromptShown");
            }
        }
    };

    const arraysHaveSameValues = <T,>(left: T[], right: T[]): boolean => {
        if (left.length !== right.length) return false;
        return left.every((value, index) => value === right[index]);
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (value) {
                    next.set("search", value);
                } else {
                    next.delete("search");
                }
                return next;
            },
            { replace: true }
        );
    };

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
                fetchExternalJobs(),
            ]);

            const [
                jobsResult,
                appliedJobsResult,
                externalJobsResult,
            ] = results;

            let featuredJobsData: FeaturedJob[] = [];
            if (jobsResult.status === "fulfilled" && jobsResult.value.ok) {
                const jobs = await jobsResult.value.json();
                featuredJobsData = (jobs.jobs || []).map((job: any) => ({
                    ...job,
                    featured: true,
                }));
            } else if (jobsResult.status === "rejected") {
                console.error(
                    "Failed to fetch featured jobs:",
                    jobsResult.reason
                );
            }

            let appliedJobIdsData = new Set<string>();
            if (appliedJobsResult.status === "fulfilled") {
                const appliedJobsData = await appliedJobsResult.value.json();
                if (Array.isArray(appliedJobsData)) {
                    appliedJobIdsData = new Set(
                        appliedJobsData.map((item: any) => item.jobId)
                    );
                    appliedJobIdsData = new Set(appliedJobsData);
                }
            } else {
                console.error(
                    "Failed to fetch applied jobs:",
                    appliedJobsResult.reason
                );
            }

            let externalJobsData: ExternalJob[] = [];
            if (externalJobsResult.status === "fulfilled") {
                externalJobsData = externalJobsResult.value;
            } else {
                console.error(
                    "Failed to fetch external jobs:",
                    externalJobsResult.reason
                );
            }

            setFeaturedJobs(featuredJobsData);
            setAppliedJobIds(appliedJobIdsData);
            setExternalJobs(externalJobsData);

            // Precompute categories and locations
            const allJobsTemp = [...featuredJobsData, ...externalJobsData];
            const cats = new Set<string>();
            allJobsTemp.forEach((job) => {
                if ("category" in job && job.category) cats.add(job.category);
            });
            setCategories(
                Array.from(cats)
                    .filter((cat) => cat.trim() !== "")
                    .sort()
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
            ...externalJobs.map((job) => ({
                ...job,
                featured: false as const,
            })),
        ];
        // Sort by featured first, then by date (for external, date_posted desc, for featured, assume recent)
        return combined.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            if (!a.featured && !b.featured) {
                return (
                    (b as ExternalJob).date_posted -
                    (a as ExternalJob).date_posted
                );
            }
            return 0;
        });
    }, [featuredJobs, externalJobs]);

    const types = ["internship", "new-grad", "featured"] as const;
    const workModes = ["onsite", "hybrid", "remote"] as const;
    type WorkModeValue = (typeof workModes)[number];
    const typeLabel: Record<(typeof types)[number], string> = {
        internship: "Internship",
        "new-grad": "New Grad",
        featured: "Featured",
    };
    const workModeLabel: Record<(typeof workModes)[number], string> = {
        onsite: "Onsite",
        hybrid: "Hybrid",
        remote: "Remote",
    };

    const normalizedLocationsByJob = useMemo(() => {
        const output = new Map<string, NormalizedJobLocation[]>();
        allJobs.forEach((job) => {
            if ("locations" in job) {
                // Recompute from raw locations to avoid stale/incorrect upstream normalized payloads.
                output.set(job.id, normalizeLocations(job.locations || []));
            } else {
                output.set(job.id, normalizeLocations(job.location ? [job.location] : []));
            }
        });
        return output;
    }, [allJobs]);

    const filterIndex = useMemo(() => {
        const allLocations = Array.from(normalizedLocationsByJob.values()).flat();
        return buildFilterIndex(allLocations);
    }, [normalizedLocationsByJob]);

    const cityToKey = (city: string): string =>
        normalizeSearchText(city).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const normalizedSearch = useMemo(() => normalizeSearchText(searchTerm), [searchTerm]);

    type ActiveFilters = {
        types: string[];
        categories: string[];
        workModes: Array<"onsite" | "hybrid" | "remote">;
        country: string;
        state: string;
        cities: string[];
        search: string;
    };

    const activeFilters: ActiveFilters = useMemo(
        () => ({
            types: selectedTypes,
            categories: selectedCategories,
            workModes: selectedWorkModes,
            country: selectedCountry,
            state: selectedState,
            cities: selectedCities,
            search: normalizedSearch,
        }),
        [
            selectedTypes,
            selectedCategories,
            selectedWorkModes,
            selectedCountry,
            selectedState,
            selectedCities,
            normalizedSearch,
        ]
    );

    const getJobTypeValue = (job: UnifiedJob): string =>
        job.featured ? "featured" : job.type;

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
        const normalizedLocations = normalizedLocationsByJob.get(job.id) || [];
        fields.push(
            ...normalizedLocations.map((loc) =>
                [
                    loc.normalized.city,
                    loc.normalized.region,
                    loc.normalized.country,
                    loc.raw,
                ]
                    .filter(Boolean)
                    .join(" ")
            )
        );
        return normalizeSearchText(fields.join(" "));
    };

    // Precomputed per-job searchable text, keyed only on allJobs (not on the
    // active filters). matchJobWithFilters is invoked once per job per facet
    // (7 passes: filteredJobs + 6 facet-count scans) on every keystroke, so
    // recomputing getSearchableText from scratch each time was O(jobs × 7)
    // string-building work per keystroke across ~11k jobs.
    const searchableTextByJob = useMemo(() => {
        const output = new Map<string, string>();
        allJobs.forEach((job) => {
            output.set(job.id, getSearchableText(job));
        });
        return output;
    }, [allJobs, normalizedLocationsByJob]);

    const matchJobWithFilters = (
        job: UnifiedJob,
        filters: ActiveFilters,
        ignoreFacet?: "types" | "categories" | "workModes" | "countries" | "states" | "cities"
    ): boolean => {
        const searchableText = searchableTextByJob.get(job.id) || "";
        const matchesSearch = filters.search.length === 0 || searchableText.includes(filters.search);
        if (!matchesSearch) return false;

        const jobType = getJobTypeValue(job);
        if (ignoreFacet !== "types" && filters.types.length > 0 && !filters.types.includes(jobType)) {
            return false;
        }

        const category = "category" in job ? job.category : null;
        if (
            ignoreFacet !== "categories" &&
            filters.categories.length > 0 &&
            (!category || !filters.categories.includes(category))
        ) {
            return false;
        }

        const normalized = normalizedLocationsByJob.get(job.id) || [];
        if (
            ignoreFacet !== "workModes" &&
            filters.workModes.length > 0 &&
            !normalized.some((loc) => filters.workModes.includes(loc.type))
        ) {
            return false;
        }

        if (
            ignoreFacet !== "countries" &&
            !matchLocationFilters(normalized, {
                countryCode: filters.country,
                regionKey: "all",
                cityKey: "all",
            })
        ) {
            return false;
        }

        if (
            ignoreFacet !== "states" &&
            !matchLocationFilters(normalized, {
                countryCode: filters.country,
                regionKey: filters.state,
                cityKey: "all",
            })
        ) {
            return false;
        }

        if (ignoreFacet !== "cities" && filters.cities.length > 0) {
            const cityMatch = normalized.some((location) => {
                if (!location.normalized.city) return false;
                const cityKey = cityToKey(location.normalized.city);
                if (filters.country !== "all" && location.normalized.country_code !== filters.country) return false;
                if (
                    filters.state !== "all" &&
                    (location.normalized.region_code ||
                        (location.normalized.region
                            ? normalizeSearchText(location.normalized.region)
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/^-|-$/g, "")
                            : "")) !== filters.state
                ) {
                    return false;
                }
                return filters.cities.includes(cityKey);
            });
            if (!cityMatch) return false;
        }

        return true;
    };

    const getDisplayLocationsForJob = (job: UnifiedJob): NormalizedJobLocation[] => {
        const normalized = normalizedLocationsByJob.get(job.id) || [];
        if (selectedCountry === "all") return normalized;
        const matchingLocations = normalized.filter((location) => {
            if (location.normalized.country_code !== selectedCountry) return false;
            if (
                selectedState !== "all" &&
                (location.normalized.region_code ||
                    (location.normalized.region
                        ? normalizeSearchText(location.normalized.region)
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-|-$/g, "")
                        : "")) !== selectedState
            ) {
                return false;
            }
            if (selectedCities.length > 0) {
                if (!location.normalized.city) return false;
                const cityKey = cityToKey(location.normalized.city);
                if (!selectedCities.includes(cityKey)) return false;
            }
            return true;
        });
        return matchingLocations.length > 0 ? matchingLocations : normalized;
    };

    const computeFacetCounts = (
        facet: "types" | "categories" | "workModes" | "countries" | "states" | "cities"
    ): Map<string, number> => {
        const counts = new Map<string, number>();
        allJobs.forEach((job) => {
            if (!matchJobWithFilters(job, activeFilters, facet)) return;
            const normalized = normalizedLocationsByJob.get(job.id) || [];
            const values = new Set<string>();
            if (facet === "types") {
                values.add(getJobTypeValue(job));
            } else if (facet === "categories") {
                if ("category" in job && job.category) values.add(job.category);
            } else if (facet === "workModes") {
                normalized.forEach((loc) => values.add(loc.type));
            } else if (facet === "countries") {
                normalized.forEach((loc) => {
                    if (loc.normalized.country_code) values.add(loc.normalized.country_code);
                });
            } else if (facet === "states" && selectedCountry !== "all") {
                normalized.forEach((loc) => {
                    if (loc.normalized.country_code !== selectedCountry) return;
                    const stateKey =
                        loc.normalized.region_code ||
                        (loc.normalized.region
                            ? normalizeSearchText(loc.normalized.region)
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/^-|-$/g, "")
                            : "");
                    if (stateKey) values.add(stateKey);
                });
            } else if (facet === "cities" && selectedCountry !== "all") {
                normalized.forEach((loc) => {
                    if (loc.normalized.country_code !== selectedCountry) return;
                    const stateKey =
                        loc.normalized.region_code ||
                        (loc.normalized.region
                            ? normalizeSearchText(loc.normalized.region)
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/^-|-$/g, "")
                            : "");
                    if (selectedState !== "all" && stateKey !== selectedState) return;
                    if (loc.normalized.city) values.add(cityToKey(loc.normalized.city));
                });
            }
            values.forEach((value) => {
                counts.set(value, (counts.get(value) || 0) + 1);
            });
        });
        return counts;
    };

    const typeCounts = useMemo(() => computeFacetCounts("types"), [allJobs, activeFilters, normalizedLocationsByJob]);
    const categoryCounts = useMemo(() => computeFacetCounts("categories"), [allJobs, activeFilters, normalizedLocationsByJob]);
    const workModeCounts = useMemo(() => computeFacetCounts("workModes"), [allJobs, activeFilters, normalizedLocationsByJob]);
    const countryCounts = useMemo(() => computeFacetCounts("countries"), [allJobs, activeFilters, normalizedLocationsByJob]);
    // computeFacetCounts("states"/"cities") only ever adds values when
    // selectedCountry !== "all" (see the facet branches above), so the result
    // is always an empty Map when no country is selected — skip the full
    // allJobs scan in that case rather than doing the work to get nothing.
    const stateCounts = useMemo(
        () => (selectedCountry === "all" ? new Map<string, number>() : computeFacetCounts("states")),
        [allJobs, activeFilters, normalizedLocationsByJob, selectedCountry]
    );
    const cityCounts = useMemo(
        () => (selectedCountry === "all" ? new Map<string, number>() : computeFacetCounts("cities")),
        [allJobs, activeFilters, normalizedLocationsByJob, selectedCountry, selectedState]
    );

    const sortByCountThenLabel = <
        T extends { value: string; label: string; count: number },
    >(
        items: T[]
    ) =>
        items.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.label.localeCompare(b.label);
        });

    const availableTypeOptions = useMemo(
        () =>
            sortByCountThenLabel(
                types.map((type) => ({
                    value: type,
                    label: typeLabel[type],
                    count: typeCounts.get(type) || 0,
                }))
            ).filter((opt) => opt.count > 0 || selectedTypes.includes(opt.value)),
        [typeCounts, selectedTypes]
    );

    const availableCategoryOptions = useMemo(
        () =>
            sortByCountThenLabel(
                categories.map((category) => ({
                    value: category,
                    label: category,
                    count: categoryCounts.get(category) || 0,
                }))
            ).filter((opt) => opt.count > 0 || selectedCategories.includes(opt.value)),
        [categories, categoryCounts, selectedCategories]
    );

    const availableWorkModeOptions = useMemo(
        () =>
            sortByCountThenLabel(
            workModes.map((mode) => ({
                    value: mode,
                    label: workModeLabel[mode],
                    count: workModeCounts.get(mode) || 0,
                }))
            ).filter((opt) => opt.count > 0 || selectedWorkModes.includes(opt.value)),
        [workModeCounts, selectedWorkModes]
    );

    const availableCountries = useMemo(
        () =>
            sortByCountThenLabel(
                filterIndex.countries.map((country) => ({
                    value: country.value,
                    label: country.label,
                    count: countryCounts.get(country.value) || 0,
                }))
            ).filter((opt) => opt.count > 0 || selectedCountry === opt.value),
        [filterIndex, countryCounts, selectedCountry]
    );

    const availableStates = useMemo(() => {
        if (selectedCountry === "all") return [];
        const states = filterIndex.statesByCountry[selectedCountry] || [];
        return sortByCountThenLabel(
            states.map((state) => ({
                value: state.value,
                label: state.label,
                count: stateCounts.get(state.value) || 0,
            }))
        ).filter((opt) => opt.count > 0 || selectedState === opt.value);
    }, [filterIndex, selectedCountry, stateCounts, selectedState]);

    const availableCities = useMemo(() => {
        if (selectedCountry === "all") return [];
        const cities =
            selectedState === "all"
                ? filterIndex.citiesByCountry[selectedCountry] || []
                : filterIndex.citiesByCountryState[`${selectedCountry}::${selectedState}`] || [];
        return sortByCountThenLabel(
            cities.map((city) => ({
                value: city.value,
                label: city.label,
                count: cityCounts.get(city.value) || 0,
            }))
        ).filter((opt) => opt.count > 0 || selectedCities.includes(opt.value));
    }, [filterIndex, selectedCountry, selectedState, cityCounts, selectedCities]);

    const filteredJobs = useMemo(() => {
        let filtered = allJobs.filter((job) => matchJobWithFilters(job, activeFilters));
        if (showSavedOnly) filtered = filtered.filter((job) => savedIds.includes(job.id));
        if (limit) filtered = filtered.slice(0, limit);
        return filtered;
    }, [
        allJobs,
        activeFilters,
        limit,
        normalizedLocationsByJob,
        showSavedOnly,
        savedIds,
    ]);

    useEffect(() => {
        if (selectedCountry !== "all" && !availableCountries.some((c) => c.value === selectedCountry)) {
            setSelectedCountry("all");
            setSelectedState("all");
            setSelectedCities([]);
        }
    }, [selectedCountry, availableCountries]);

    useEffect(() => {
        if (selectedState !== "all" && !availableStates.some((s) => s.value === selectedState)) {
            setSelectedState("all");
            setSelectedCities([]);
        }
    }, [selectedState, availableStates]);

    useEffect(() => {
        const citySet = new Set(availableCities.map((c) => c.value));
        setSelectedCities((prev) => {
            const next = prev.filter((city) => citySet.has(city));
            return arraysHaveSameValues(prev, next) ? prev : next;
        });
    }, [availableCities]);

    useEffect(() => {
        const typeSet = new Set<string>(
            availableTypeOptions.map((opt) => opt.value)
        );
        setSelectedTypes((prev) => {
            const next = prev.filter((type) => typeSet.has(type));
            return arraysHaveSameValues(prev, next) ? prev : next;
        });
    }, [availableTypeOptions]);

    useEffect(() => {
        const categorySet = new Set(availableCategoryOptions.map((opt) => opt.value));
        setSelectedCategories((prev) => {
            const next = prev.filter((category) => categorySet.has(category));
            return arraysHaveSameValues(prev, next) ? prev : next;
        });
    }, [availableCategoryOptions]);

    useEffect(() => {
        const modeSet = new Set(availableWorkModeOptions.map((opt) => opt.value));
        setSelectedWorkModes((prev) => {
            const next = prev.filter((mode) => modeSet.has(mode));
            return arraysHaveSameValues(prev, next) ? prev : next;
        });
    }, [availableWorkModeOptions]);

    // Resets the "load more" window back to the first page whenever the
    // filtered set changes. The alert banner's row-index anchor
    // (alertBannerRowIndex below) assumes visibleCount has just been reset to
    // 20 on every filter/search change — don't change this without checking
    // that coupling.
    useEffect(() => {
        setVisibleCount(20);
    }, [filteredJobs]);

    const searchActive = normalizedSearch.length > 0;
    // Slim job-alert banner: shown once a search is active or the visitor has
    // scrolled past the first page of results; suppressed once subscribed.
    const showAlertBanner = !isJobAlertSubscribed() && (searchActive || visibleCount > 20);
    const displayedJobCount = Math.min(filteredJobs.length, visibleCount);
    // When a search is active and it returns a short (but non-zero) result
    // set, there aren't 6 rows to anchor the banner after — show it right
    // after the last result row instead so this high-intent moment still
    // gets a capture surface. Otherwise keep the existing row-6 anchor.
    const showShortSearchBanner = searchActive && filteredJobs.length > 0 && filteredJobs.length <= 6;
    // Row index 5 (i.e. after the 6th result) assumes visibleCount was just
    // reset to 20 by the effect above whenever filteredJobs changes — don't
    // change one without checking the other.
    const alertBannerRowIndex = showShortSearchBanner ? displayedJobCount - 1 : 5;

    const handleJobClick = (job: UnifiedJob) => {
        if (job.featured) {
            navigate(`/jobs/${job.id}/`);
        } else {
            navigate(`/jobs/e/${encodeURIComponent(job.id)}`);
        }
    };

    if (loading) {
        return (
            <div className={isPreview ? "w-full" : "container mx-auto py-8"}>
                <div className={isPreview ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
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
        <div className={isPreview ? "w-full" : "container mx-auto py-8"}>
            {!isPreview && (
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-4">Job Opportunities</h1>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Input
                            placeholder="Search all fields..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-64"
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-40 justify-start font-normal">
                                    {selectedTypes.length === 0
                                        ? "All Types"
                                        : selectedTypes.length === 1
                                          ? "1 type selected"
                                          : `${selectedTypes.length} types selected`}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                                <DropdownMenuItem onClick={() => setSelectedTypes([])}>
                                    Clear type filters
                                </DropdownMenuItem>
                                {availableTypeOptions.map((type) => (
                                    <DropdownMenuCheckboxItem
                                        key={type.value}
                                        checked={selectedTypes.includes(type.value)}
                                        onCheckedChange={(checked) => {
                                            setSelectedTypes((prev) =>
                                                checked
                                                    ? [...prev, type.value]
                                                    : prev.filter((value) => value !== type.value)
                                            );
                                        }}
                                    >
                                        {type.label} ({type.count})
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {categories.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full sm:w-52 justify-start font-normal">
                                        {selectedCategories.length === 0
                                            ? "All Categories"
                                            : selectedCategories.length === 1
                                              ? "1 category selected"
                                              : `${selectedCategories.length} categories selected`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-72 max-h-72 overflow-y-auto">
                                    <DropdownMenuItem onClick={() => setSelectedCategories([])}>
                                        Clear category filters
                                    </DropdownMenuItem>
                                    {availableCategoryOptions.map((category) => (
                                        <DropdownMenuCheckboxItem
                                            key={category.value}
                                            checked={selectedCategories.includes(category.value)}
                                            onCheckedChange={(checked) => {
                                                setSelectedCategories((prev) =>
                                                    checked
                                                        ? [...prev, category.value]
                                                        : prev.filter((value) => value !== category.value)
                                                );
                                            }}
                                        >
                                            {category.label} ({category.count})
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-44 justify-start font-normal">
                                    {selectedWorkModes.length === 0
                                        ? "All Work Modes"
                                        : selectedWorkModes.length === 1
                                          ? "1 mode selected"
                                          : `${selectedWorkModes.length} modes selected`}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
                                <DropdownMenuItem onClick={() => setSelectedWorkModes([])}>
                                    Clear work mode filters
                                </DropdownMenuItem>
                                {availableWorkModeOptions.map((mode) => (
                                    <DropdownMenuCheckboxItem
                                        key={mode.value}
                                        checked={selectedWorkModes.includes(mode.value as WorkModeValue)}
                                        onCheckedChange={(checked) => {
                                            setSelectedWorkModes((prev) =>
                                                checked
                                                    ? [...prev, mode.value as WorkModeValue]
                                                    : prev.filter((value) => value !== mode.value)
                                            );
                                        }}
                                    >
                                        {mode.label} ({mode.count})
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Select
                            value={selectedCountry}
                            onValueChange={(value) => {
                                setSelectedCountry(value);
                                setSelectedState("all");
                                setSelectedCities([]);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-32">
                                <SelectValue placeholder="Country" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Countries</SelectItem>
                                {availableCountries.map((country) => (
                                    <SelectItem key={country.value} value={country.value}>
                                        {country.label} ({country.count})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedCountry !== "all" &&
                            availableStates.length > 0 && (
                                <Select
                                    value={selectedState}
                                    onValueChange={(value) => {
                                        setSelectedState(value);
                                        setSelectedCities([]);
                                    }}
                                >
                                <SelectTrigger className="w-full sm:w-32">
                                    <SelectValue placeholder="State" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All States
                                    </SelectItem>
                                    {availableStates.map((state) => (
                                        <SelectItem key={state.value} value={state.value}>
                                            {state.label} ({state.count})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {selectedState !== "all" && availableCities.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-48 justify-start font-normal"
                                    >
                                        {selectedCities.length === 0
                                            ? "All Cities"
                                            : selectedCities.length === 1
                                              ? "1 city selected"
                                              : `${selectedCities.length} cities selected`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
                                    <DropdownMenuItem onClick={() => setSelectedCities([])}>
                                        Clear city filters
                                    </DropdownMenuItem>
                                    {availableCities.map((city) => (
                                        <DropdownMenuCheckboxItem
                                            key={city.value}
                                            checked={selectedCities.includes(city.value)}
                                            onCheckedChange={(checked) => {
                                                setSelectedCities((prev) =>
                                                    checked
                                                        ? [...prev, city.value]
                                                        : prev.filter((value) => value !== city.value)
                                                );
                                            }}
                                        >
                                            {city.label} ({city.count})
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {(selectedCountry !== "all" ||
                            selectedState !== "all" ||
                            selectedCities.length > 0) && (
                            <Button
                                variant="ghost"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    setSelectedCountry("all");
                                    setSelectedState("all");
                                    setSelectedCities([]);
                                }}
                            >
                                Clear location filters
                            </Button>
                        )}
                        <Button
                            variant={showSavedOnly ? "default" : "outline"}
                            className="w-full sm:w-auto"
                            onClick={() => setShowSavedOnly((prev) => !prev)}
                        >
                            <Bookmark className={cn("h-4 w-4", showSavedOnly && "fill-current")} />
                            Saved{savedIds.length > 0 ? ` (${savedIds.length})` : ""}
                        </Button>
                    </div>
                </div>
            )}

            {!isPreview && (
                <div className="mb-4">
                    <p className="text-muted-foreground">
                        Showing {filteredJobs.length} opportunities
                    </p>
                </div>
            )}

            <div className={isPreview ? "flex flex-col gap-4" : "flex flex-col gap-6"}>
                {filteredJobs.slice(0, visibleCount).map((job, index) => (
                    <Fragment key={job.id}>
                    <Card
                        className={
                            isPreview
                                ? "hover:shadow-md transition-shadow cursor-pointer"
                                : "hover:shadow-lg transition-shadow cursor-pointer"
                        }
                        onClick={() => handleJobClick(job)}
                        ref={
                            index === visibleCount - 1
                                ? setLastItemRef
                                : undefined
                        }
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {job.featured && job.organization.logo ? (
                                        <img
                                            src={job.organization.logo}
                                            alt={`${job.organization.name} logo`}
                                            className="h-16 w-16 object-contain"
                                        />
                                    ) : (
                                        <Building2 className="h-5 w-5 text-muted-foreground" />
                                    )}
                                    <CardTitle className="text-lg">
                                        {job.featured
                                            ? job.organization.name
                                            : job.company_name}
                                    </CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => handleToggleSaved(e, job.id)}
                                        aria-label={isSaved(job.id) ? "Remove from saved jobs" : "Save job"}
                                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                    >
                                        <Bookmark
                                            className={cn(
                                                "h-4 w-4",
                                                isSaved(job.id) ? "fill-current text-primary" : "text-muted-foreground"
                                            )}
                                        />
                                    </button>
                                    {job.featured && (
                                        <Badge variant="default">
                                            <Star className="h-3 w-3 mr-1" />
                                            Featured
                                        </Badge>
                                    )}
                                    <Badge
                                        variant={
                                            job.type === "internship"
                                                ? "secondary"
                                                : "default"
                                        }
                                    >
                                        {job.type === "internship"
                                            ? "Internship"
                                            : "New Grad"}
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
                                            ? formatLocationForDisplay(
                                                  getDisplayLocationsForJob(job)
                                              ) || "Location not specified"
                                            : formatLocationForDisplay(
                                                  getDisplayLocationsForJob(job)
                                              ) || "Location not specified"}
                                    </span>
                                </div>
                                {"terms" in job &&
                                    job.terms &&
                                    job.terms.length > 0 && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            <span>{job.terms.join(", ")}</span>
                                        </div>
                                    )}
                                {"degrees" in job &&
                                    job.degrees &&
                                    job.degrees.length > 0 && (
                                        <div className="flex items-center gap-1">
                                            <span>
                                                Degrees:{" "}
                                                {job.degrees.join(", ")}
                                            </span>
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
                                <div
                                    className="mt-4 inline-flex items-center gap-1 text-primary text-sm hover:underline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        trackEvent("job_apply_click", { jobId: job.id, source: "board" });
                                        window.open(
                                            job.url,
                                            "_blank",
                                            "noopener"
                                        );
                                    }}
                                >
                                    Apply externally{" "}
                                    <ExternalLink className="h-4 w-4 inline" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    {!isPreview && showAlertBanner && index === alertBannerRowIndex && (
                        <div className="rounded-lg border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                            <p className="text-sm font-medium">
                                Get new {searchActive ? `"${searchTerm.trim()}"` : ""} roles in your inbox every morning
                            </p>
                            <JobAlertSignup
                                source="search"
                                variant="inline"
                                query={searchActive ? searchTerm.trim() : undefined}
                                jobType={
                                    selectedTypes.length === 1 && selectedTypes[0] !== "featured"
                                        ? (selectedTypes[0] as "internship" | "new-grad")
                                        : undefined
                                }
                                locations={selectedCities.length > 0 ? selectedCities : undefined}
                                className="sm:max-w-xs"
                            />
                        </div>
                    )}
                    </Fragment>
                ))}
            </div>

            {filteredJobs.length === 0 && (
                <div className="text-center py-12 space-y-4">
                    <p className="text-muted-foreground">
                        No jobs found matching your criteria.
                    </p>
                    {!isPreview && !isJobAlertSubscribed() && (
                        <div className="max-w-sm mx-auto text-left">
                            <p className="text-sm font-medium mb-2 text-center">
                                Get notified when new roles matching your search go live
                            </p>
                            <JobAlertSignup
                                source="search"
                                variant="inline"
                                query={searchActive ? searchTerm.trim() : undefined}
                            />
                        </div>
                    )}
                </div>
            )}

            {showSavePrompt && !showAlertBanner && (
                <FloatingCaptureCard
                    icon={Bookmark}
                    title="Want your saved jobs + fresh matches in your inbox?"
                    onDismiss={() => setShowSavePrompt(false)}
                >
                    <JobAlertSignup
                        source="save_job"
                        variant="inline"
                        onSubscribed={() => setShowSavePrompt(false)}
                    />
                </FloatingCaptureCard>
            )}
        </div>
    );
}

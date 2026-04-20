import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
    variant?: "full" | "preview";
}

export function UnifiedJobBoard({ limit, variant = "full" }: UnifiedJobBoardProps) {
    const isPreview = variant === "preview";
    const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([]);
    const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string>("all");
    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedWorkModes, setSelectedWorkModes] = useState<Array<"onsite" | "hybrid" | "remote">>([]);
    const [includeUnresolvedLocations, setIncludeUnresolvedLocations] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(20);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const currentObservedRef = useRef<Element | null>(null);
    const navigate = useNavigate();

    const arraysHaveSameValues = <T,>(left: T[], right: T[]): boolean => {
        if (left.length !== right.length) return false;
        return left.every((value, index) => value === right[index]);
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
                fetch(INTERNSHIPS_URL),
                fetch(NEW_GRADS_URL),
            ]);

            const [
                jobsResult,
                appliedJobsResult,
                internshipsResult,
                newGradsResult,
            ] = results;

            let featuredJobsData: FeaturedJob[] = [];
            if (jobsResult.status === "fulfilled") {
                const jobs = await jobsResult.value.json();
                featuredJobsData = jobs.jobs.map((job: any) => ({
                    ...job,
                    featured: true,
                }));
            } else {
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
            if (internshipsResult.status === "fulfilled") {
                const internships: ExternalJob[] =
                    await internshipsResult.value.json();
                externalJobsData.push(
                    ...internships.map((job) => ({
                        ...job,
                        type: "internship" as const,
                    }))
                );
            } else {
                console.error(
                    "Failed to fetch internships:",
                    internshipsResult.reason
                );
            }

            if (newGradsResult.status === "fulfilled") {
                const newGrads: ExternalJob[] =
                    await newGradsResult.value.json();
                externalJobsData.push(
                    ...newGrads.map((job) => ({
                        ...job,
                        type: "new-grad" as const,
                    }))
                );
            } else {
                console.error(
                    "Failed to fetch new grads:",
                    newGradsResult.reason
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
    const isDebugMode = import.meta.env.DEV;
    const getStateKey = (location: NormalizedJobLocation): string =>
        location.normalized.region_code ||
        (location.normalized.region
            ? normalizeSearchText(location.normalized.region)
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
            : "");
    const getGeoEligibleLocations = (
        locations: NormalizedJobLocation[],
        includeUnresolved: boolean
    ): NormalizedJobLocation[] =>
        locations.filter(
            (location) =>
                location.type !== "remote" && (includeUnresolved || !location.unresolved)
        );
    const toggleMultiValue = <T extends string>(
        prev: T[],
        value: T,
        checked: boolean | "indeterminate"
    ): T[] => {
        if (checked === true) return prev.includes(value) ? prev : [...prev, value];
        return prev.filter((item) => item !== value);
    };
    const normalizedSearch = useMemo(() => normalizeSearchText(searchTerm), [searchTerm]);

    type ActiveFilters = {
        types: string[];
        categories: string[];
        workModes: Array<"onsite" | "hybrid" | "remote">;
        country: string;
        states: string[];
        cities: string[];
        includeUnresolvedLocations: boolean;
        search: string;
    };

    const activeFilters: ActiveFilters = useMemo(
        () => ({
            types: selectedTypes,
            categories: selectedCategories,
            workModes: selectedWorkModes,
            country: selectedCountry,
            states: selectedStates,
            cities: selectedCities,
            includeUnresolvedLocations,
            search: normalizedSearch,
        }),
        [
            selectedTypes,
            selectedCategories,
            selectedWorkModes,
            selectedCountry,
            selectedStates,
            selectedCities,
            includeUnresolvedLocations,
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

    const matchJobWithFilters = (
        job: UnifiedJob,
        filters: ActiveFilters,
        ignoreFacet?: "types" | "categories" | "workModes" | "countries" | "states" | "cities"
    ): boolean => {
        const searchableText = getSearchableText(job);
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
        if (!filters.includeUnresolvedLocations && !normalized.some((location) => !location.unresolved)) {
            return false;
        }
        const geoLocations = getGeoEligibleLocations(normalized, filters.includeUnresolvedLocations);
        if (
            ignoreFacet !== "workModes" &&
            filters.workModes.length > 0 &&
            !normalized.some((loc) => filters.workModes.includes(loc.type))
        ) {
            return false;
        }

        if (
            ignoreFacet !== "countries" &&
            !matchLocationFilters(geoLocations, {
                countryCode: filters.country,
                regionKey: "all",
                cityKey: "all",
            })
        ) {
            return false;
        }

        if (ignoreFacet !== "states" && filters.states.length > 0) {
            const hasStateMatch = geoLocations.some((location) => {
                if (filters.country !== "all" && location.normalized.country_code !== filters.country) {
                    return false;
                }
                const stateKey = getStateKey(location);
                return stateKey.length > 0 && filters.states.includes(stateKey);
            });
            if (!hasStateMatch) return false;
        }

        if (ignoreFacet !== "cities" && filters.cities.length > 0) {
            const cityMatch = geoLocations.some((location) => {
                if (!location.normalized.city) return false;
                const cityKey = cityToKey(location.normalized.city);
                if (filters.country !== "all" && location.normalized.country_code !== filters.country) return false;
                if (
                    filters.states.length > 0 &&
                    !filters.states.includes(getStateKey(location))
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
        const visibleLocations = includeUnresolvedLocations
            ? normalized
            : normalized.filter((location) => !location.unresolved);
        if (selectedCountry === "all") return visibleLocations;
        const matchingLocations = visibleLocations.filter((location) => {
            if (location.type === "remote") return false;
            if (location.normalized.country_code !== selectedCountry) return false;
            if (
                selectedStates.length > 0 &&
                !selectedStates.includes(getStateKey(location))
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
        return matchingLocations.length > 0 ? matchingLocations : visibleLocations;
    };

    const computeFacetCounts = (
        facet: "types" | "categories" | "workModes" | "countries" | "states" | "cities"
    ): Map<string, number> => {
        const counts = new Map<string, number>();
        allJobs.forEach((job) => {
            if (!matchJobWithFilters(job, activeFilters, facet)) return;
            const normalized = normalizedLocationsByJob.get(job.id) || [];
            const geoLocations = getGeoEligibleLocations(normalized, activeFilters.includeUnresolvedLocations);
            const values = new Set<string>();
            if (facet === "types") {
                values.add(getJobTypeValue(job));
            } else if (facet === "categories") {
                if ("category" in job && job.category) values.add(job.category);
            } else if (facet === "workModes") {
                normalized.forEach((loc) => values.add(loc.type));
            } else if (facet === "countries") {
                geoLocations.forEach((loc) => {
                    if (loc.normalized.country_code) values.add(loc.normalized.country_code);
                });
            } else if (facet === "states" && selectedCountry !== "all") {
                geoLocations.forEach((loc) => {
                    if (loc.normalized.country_code !== selectedCountry) return;
                    const stateKey = getStateKey(loc);
                    if (stateKey) values.add(stateKey);
                });
            } else if (facet === "cities" && selectedCountry !== "all") {
                geoLocations.forEach((loc) => {
                    if (loc.normalized.country_code !== selectedCountry) return;
                    const stateKey = getStateKey(loc);
                    if (selectedStates.length > 0 && !selectedStates.includes(stateKey)) return;
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
    const stateCounts = useMemo(() => computeFacetCounts("states"), [allJobs, activeFilters, normalizedLocationsByJob, selectedCountry]);
    const cityCounts = useMemo(() => computeFacetCounts("cities"), [allJobs, activeFilters, normalizedLocationsByJob, selectedCountry, selectedStates]);

    const sortByCountThenLabel = (
        items: Array<{ value: string; label: string; count: number }>
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
        ).filter((opt) => opt.count > 0 || selectedStates.includes(opt.value));
    }, [filterIndex, selectedCountry, stateCounts, selectedStates]);

    const availableCities = useMemo(() => {
        if (selectedCountry === "all") return [];
        const cities = selectedStates.length === 0
            ? filterIndex.citiesByCountry[selectedCountry] || []
            : (() => {
                const merged = new Map<string, { value: string; label: string }>();
                selectedStates.forEach((stateKey) => {
                    const scoped = filterIndex.citiesByCountryState[`${selectedCountry}::${stateKey}`] || [];
                    scoped.forEach((city) => merged.set(city.value, city));
                });
                return Array.from(merged.values());
            })();
        return sortByCountThenLabel(
            cities.map((city) => ({
                value: city.value,
                label: city.label,
                count: cityCounts.get(city.value) || 0,
            }))
        ).filter((opt) => opt.count > 0 || selectedCities.includes(opt.value));
    }, [filterIndex, selectedCountry, selectedStates, cityCounts, selectedCities]);

    const filteredJobs = useMemo(() => {
        let filtered = allJobs.filter((job) => matchJobWithFilters(job, activeFilters));
        if (limit) filtered = filtered.slice(0, limit);
        return filtered;
    }, [
        allJobs,
        activeFilters,
        limit,
        normalizedLocationsByJob,
    ]);

    useEffect(() => {
        if (selectedCountry !== "all" && !availableCountries.some((c) => c.value === selectedCountry)) {
            setSelectedCountry("all");
            setSelectedStates([]);
            setSelectedCities([]);
        }
    }, [selectedCountry, availableCountries]);

    useEffect(() => {
        const stateSet = new Set(availableStates.map((s) => s.value));
        setSelectedStates((prev) => {
            const next = prev.filter((state) => stateSet.has(state));
            return next.length === prev.length ? prev : next;
        });
        if (selectedStates.some((state) => !stateSet.has(state))) {
            setSelectedCities([]);
        }
    }, [availableStates, selectedStates]);

    useEffect(() => {
        const citySet = new Set(availableCities.map((c) => c.value));
        setSelectedCities((prev) => {
            const next = prev.filter((city) => citySet.has(city));
            return arraysHaveSameValues(prev, next) ? prev : next;
        });
    }, [availableCities]);

    useEffect(() => {
        const typeSet = new Set(availableTypeOptions.map((opt) => opt.value));
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
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                                        onSelect={(event) => event.preventDefault()}
                                        onCheckedChange={(checked) => {
                                            setSelectedTypes((prev) => toggleMultiValue(prev, type.value, checked));
                                        }}
                                    >
                                        {type.label} ({type.count})
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                        onSelect={(event) => event.preventDefault()}
                                        onCheckedChange={(checked) => {
                                            setSelectedCategories((prev) =>
                                                toggleMultiValue(prev, category.value, checked)
                                            );
                                        }}
                                    >
                                        {category.label} ({category.count})
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                        onSelect={(event) => event.preventDefault()}
                                        onCheckedChange={(checked) => {
                                            setSelectedWorkModes((prev) =>
                                                toggleMultiValue(prev, mode.value as WorkModeValue, checked)
                                            );
                                        }}
                                    >
                                        {mode.label} ({mode.count})
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {isDebugMode && (
                            <div className="flex items-center gap-2 px-1">
                                <Switch
                                    id="include-unresolved-locations"
                                    checked={includeUnresolvedLocations}
                                    onCheckedChange={setIncludeUnresolvedLocations}
                                />
                                <label
                                    htmlFor="include-unresolved-locations"
                                    className="text-sm text-muted-foreground"
                                >
                                    Include unresolved locations
                                </label>
                            </div>
                        )}
                        <Select
                            value={selectedCountry}
                            onValueChange={(value) => {
                                setSelectedCountry(value);
                                setSelectedStates([]);
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
                        {selectedCountry !== "all" && availableStates.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full sm:w-44 justify-start font-normal">
                                        {selectedStates.length === 0
                                            ? "All States"
                                            : selectedStates.length === 1
                                              ? "1 state selected"
                                              : `${selectedStates.length} states selected`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
                                    <DropdownMenuItem onClick={() => setSelectedStates([])}>
                                        Clear state filters
                                    </DropdownMenuItem>
                                    {availableStates.map((state) => (
                                        <DropdownMenuCheckboxItem
                                            key={state.value}
                                            checked={selectedStates.includes(state.value)}
                                            onSelect={(event) => event.preventDefault()}
                                            onCheckedChange={(checked) => {
                                                setSelectedStates((prev) => toggleMultiValue(prev, state.value, checked));
                                                setSelectedCities([]);
                                            }}
                                        >
                                            {state.label} ({state.count})
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {selectedCountry !== "all" && availableCities.length > 0 && (
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
                                            onSelect={(event) => event.preventDefault()}
                                            onCheckedChange={(checked) => {
                                                setSelectedCities((prev) => toggleMultiValue(prev, city.value, checked));
                                            }}
                                        >
                                            {city.label} ({city.count})
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {(selectedCountry !== "all" ||
                            selectedStates.length > 0 ||
                            selectedCities.length > 0) && (
                            <Button
                                variant="ghost"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    setSelectedCountry("all");
                                    setSelectedStates([]);
                                    setSelectedCities([]);
                                }}
                            >
                                Clear location filters
                            </Button>
                        )}
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
                    <Card
                        key={job.id}
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
                                <div className="flex gap-2">
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
                                              )
                                            : formatLocationForDisplay(
                                                  getDisplayLocationsForJob(job)
                                              )}
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
                                <div className="mt-4 text-primary text-sm">
                                    Apply externally{" "}
                                    <ExternalLink className="h-4 w-4 inline" />
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

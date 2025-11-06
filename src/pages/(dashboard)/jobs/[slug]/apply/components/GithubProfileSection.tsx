import React, { useEffect, useState } from "react";
import {
    Github,
    Loader2,
    Code,
    BarChart,
    MapPin,
    Calendar,
    Link,
    Twitter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { type GithubProfile } from "@/lib/github";
import { studentAuth, isAnonymousUser } from "@/lib/auth";
import { getContributionColor, getLanguageColor } from "../utils";
import type { ApplicationFormData } from "../types";

interface GithubProfileSectionProps {
    formData: ApplicationFormData;
    handleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    githubProfile: GithubProfile | null;
    isLoadingGithub: boolean;
    githubError: string | null;
    fetchGithubProfile: () => Promise<void>;
}

export default function GithubProfileSection({
    formData,
    handleInputChange,
    githubProfile,
    isLoadingGithub,
    githubError,
    fetchGithubProfile,
}: GithubProfileSectionProps) {
    const [isAnonymous, setIsAnonymous] = useState(true);

    // Check authentication status when component mounts
    useEffect(() => {
        const unsubscribe = studentAuth.onAuthStateChanged((user) => {
            setIsAnonymous(isAnonymousUser());
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label>GitHub Profile</Label>
                <div className="flex justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={fetchGithubProfile}
                        disabled={isLoadingGithub}
                        className="flex items-center gap-2 w-full md:w-auto"
                    >
                        <Github className="h-4 w-4" />
                        {isLoadingGithub ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : githubProfile ? (
                            <>✓ Already Connected - Update if needed</>
                        ) : isAnonymous ? (
                            <>Login with GitHub</>
                        ) : (
                            <>Connect GitHub</>
                        )}
                    </Button>
                </div>
                {githubError && (
                    <p className="text-sm text-destructive mt-1">
                        {githubError}
                    </p>
                )}
                {isAnonymous && !githubProfile && !isLoadingGithub && (
                    <p className="text-sm text-muted-foreground mt-1">
                        Connect your GitHub account to enhance your application
                        with your coding activity and projects.
                    </p>
                )}
            </div>

            {githubProfile && renderGithubProfileDetails(githubProfile)}

            <div className="space-y-2">
                <Label htmlFor="linkedinUrl">
                    LinkedIn Profile URL (Optional)
                </Label>
                <Input
                    id="linkedinUrl"
                    name="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={handleInputChange}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="portfolioUrl">
                    Portfolio Website (Optional)
                </Label>
                <Input
                    id="portfolioUrl"
                    name="portfolioUrl"
                    value={formData.portfolioUrl}
                    onChange={handleInputChange}
                />
            </div>
        </div>
    );
}

function renderGithubProfileDetails(githubProfile: GithubProfile) {
    return (
        <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                    <AvatarImage
                        src={githubProfile.avatarUrl}
                        alt={githubProfile.name}
                    />
                    <AvatarFallback>
                        {githubProfile.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                        {githubProfile.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        @{githubProfile.username}
                    </p>
                    {githubProfile.bio && (
                        <p className="mt-2 text-sm">{githubProfile.bio}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {githubProfile.location && (
                            <span className="flex items-center">
                                <MapPin className="h-3.5 w-3.5 mr-1" />
                                {githubProfile.location}
                            </span>
                        )}
                        {githubProfile.blog && (
                            <span className="flex items-center">
                                <Link className="h-3.5 w-3.5 mr-1" />
                                <a
                                    href={
                                        githubProfile.blog.startsWith("http")
                                            ? githubProfile.blog
                                            : `https://${githubProfile.blog}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    {githubProfile.blog.replace(
                                        /^https?:\/\//,
                                        ""
                                    )}
                                </a>
                            </span>
                        )}
                        {githubProfile.twitterUsername && (
                            <span className="flex items-center">
                                <Twitter className="h-3.5 w-3.5 mr-1" />
                                <a
                                    href={`https://twitter.com/${githubProfile.twitterUsername}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    @{githubProfile.twitterUsername}
                                </a>
                            </span>
                        )}
                        <span className="flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            Joined{" "}
                            {new Date(
                                githubProfile.createdAt
                            ).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                    <p className="text-lg font-semibold">
                        {githubProfile.repoCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Repositories
                    </p>
                </div>
                <div>
                    <p className="text-lg font-semibold">
                        {githubProfile.followers}
                    </p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div>
                    <p className="text-lg font-semibold">
                        {githubProfile.contributionCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Contributions
                    </p>
                </div>
                <div>
                    <p className="text-lg font-semibold">
                        {githubProfile.maxStreak}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Longest Streak
                    </p>
                </div>
            </div>

            <Separator />

            <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Code className="h-4 w-4 mr-1" /> Technical Profile
                </h4>
                <div className="space-y-3">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">
                            Top Languages
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {githubProfile.topLanguages.map((lang, index) => (
                                <Badge key={index} variant="secondary">
                                    {lang.name || lang} (
                                    {githubProfile.languageDistribution?.[index]
                                        ?.percentage || 0}
                                    %)
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {githubProfile.languageDistribution && (
                        <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                Language Distribution
                            </p>
                            <div className="space-y-2 mt-2">
                                {githubProfile.languageDistribution.map(
                                    (lang, index) => (
                                        <div key={index} className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span>{lang.language}</span>
                                                <span>{lang.percentage}%</span>
                                            </div>
                                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${lang.percentage}%`,
                                                        backgroundColor:
                                                            getLanguageColor(
                                                                lang.language
                                                            ),
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>
                                                    {lang.projects}{" "}
                                                    {lang.projects === 1
                                                        ? "project"
                                                        : "projects"}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Separator />

            {githubProfile.weeklyContributions && (
                <>
                    <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center">
                            <Calendar className="h-4 w-4 mr-1" /> Contribution
                            Activity
                        </h4>
                        <div className="overflow-x-auto pb-2">
                            <div className="min-w-[640px]">
                                <div className="flex text-xs text-muted-foreground mb-1 justify-between px-1">
                                    <span>Less</span>
                                    <span>More</span>
                                </div>
                                <div className="grid grid-rows-7 grid-flow-col gap-1">
                                    {Array(7)
                                        .fill(0)
                                        .map((_, rowIndex) => (
                                            <div
                                                key={rowIndex}
                                                className="flex flex-row gap-1"
                                            >
                                                {githubProfile.weeklyContributions.map(
                                                    (week, weekIndex) => {
                                                        const day =
                                                            week.days?.[
                                                                rowIndex
                                                            ];
                                                        const count =
                                                            day?.contributionCount ||
                                                            0;
                                                        return (
                                                            <div
                                                                key={`${weekIndex}-${rowIndex}`}
                                                                className="w-3 h-3 rounded-sm"
                                                                style={{
                                                                    backgroundColor:
                                                                        getContributionColor(
                                                                            count
                                                                        ),
                                                                }}
                                                                title={
                                                                    day
                                                                        ? `${day.date}: ${count} contributions`
                                                                        : "No contributions"
                                                                }
                                                            />
                                                        );
                                                    }
                                                )}
                                            </div>
                                        ))}
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                    <div>
                                        <div className="font-medium">
                                            Most Active Day
                                        </div>
                                        <div>
                                            {
                                                githubProfile.mostProductiveDay
                                                    ?.date
                                            }
                                            :{" "}
                                            {
                                                githubProfile.mostProductiveDay
                                                    ?.contributions
                                            }{" "}
                                            contributions
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">
                                            Weekly Average
                                        </div>
                                        <div>
                                            {(
                                                githubProfile.weeklyContributions?.reduce(
                                                    (sum, week) =>
                                                        sum + (week.count || 0),
                                                    0
                                                ) /
                                                (githubProfile
                                                    .weeklyContributions
                                                    ?.length || 1)
                                            ).toFixed(1)}{" "}
                                            contributions
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Separator />
                </>
            )}

            <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                    <BarChart className="h-4 w-4 mr-1" /> Activity Stats
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm">
                            {githubProfile.averageContributionsPerDay}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Contributions / Day
                        </p>
                    </div>
                    <div>
                        <p className="text-sm">
                            {githubProfile.activeDaysPerWeek}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Active Days / Week
                        </p>
                    </div>
                    <div>
                        <p className="text-sm">{githubProfile.currentStreak}</p>
                        <p className="text-xs text-muted-foreground">
                            Current Streak
                        </p>
                    </div>
                    <div>
                        <p className="text-sm">
                            {githubProfile.pullRequestsCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Pull Requests
                        </p>
                    </div>
                </div>
            </div>

            {githubProfile.mostStarredRepos.length > 0 && (
                <>
                    <Separator />
                    <div>
                        <h4 className="text-sm font-medium mb-2">
                            Top Repositories
                        </h4>
                        <div className="space-y-2">
                            {githubProfile.mostStarredRepos
                                .slice(0, 3)
                                .map((repo, index) => (
                                    <div
                                        key={index}
                                        className="text-sm flex justify-between"
                                    >
                                        <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline"
                                        >
                                            {repo.name}
                                        </a>
                                        <span className="text-muted-foreground">
                                            ⭐ {repo.stars}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

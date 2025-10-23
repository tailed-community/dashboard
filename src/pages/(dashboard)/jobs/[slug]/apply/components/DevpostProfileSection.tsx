import React from "react";
import { Loader2, Github, Link, Twitter, Briefcase } from "lucide-react";
import { type DevpostProfile, type ApplicationFormData } from "../types";

interface DevpostProfileSectionProps {
    formData: ApplicationFormData;
    handleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    devpostProfile: DevpostProfile | null;
    isLoadingDevpost: boolean;
    devpostError: string | null;
    fetchDevpostProfile: () => Promise<void>;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface DevpostProfileSectionProps {
    formData: FormData;
    handleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    devpostProfile: DevpostProfile | null;
    isLoadingDevpost: boolean;
    devpostError: string | null;
    fetchDevpostProfile: () => Promise<void>;
}

export default function DevpostProfileSection({
    formData,
    handleInputChange,
    devpostProfile,
    isLoadingDevpost,
    devpostError,
    fetchDevpostProfile,
}: DevpostProfileSectionProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="devpostUsername">
                    Devpost Username (for Hackathons)
                </Label>
                <div className="flex gap-2">
                    <Input
                        id="devpostUsername"
                        name="devpostUsername"
                        value={formData.devpostUsername}
                        onChange={handleInputChange}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={fetchDevpostProfile}
                        disabled={isLoadingDevpost || !formData.devpostUsername}
                    >
                        {isLoadingDevpost ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Verify"
                        )}
                    </Button>
                </div>
                {devpostError && (
                    <p className="text-sm text-destructive mt-1">
                        {devpostError}
                    </p>
                )}
            </div>

            {devpostProfile && renderDevpostProfile(devpostProfile)}

            <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                    <strong>Note:</strong> If you don't have a Devpost profile
                    or haven't participated in hackathons, you can leave this
                    field empty. This won't affect your application negatively.
                </p>
            </div>
        </div>
    );
}

function renderDevpostProfile(devpostProfile: DevpostProfile) {
    return (
        <div className="rounded-lg border p-4">
            <div className="flex items-start gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                        {devpostProfile.name || devpostProfile.username}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        @{devpostProfile.username}
                    </p>
                    {devpostProfile.bio && (
                        <p className="mt-2 text-sm">{devpostProfile.bio}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {devpostProfile.links?.github && (
                            <span className="flex items-center">
                                <Github className="h-3.5 w-3.5 mr-1" />
                                <a
                                    href={devpostProfile.links.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    GitHub
                                </a>
                            </span>
                        )}
                        {devpostProfile.links?.linkedin && (
                            <span className="flex items-center">
                                <Briefcase className="h-3.5 w-3.5 mr-1" />
                                <a
                                    href={devpostProfile.links.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    LinkedIn
                                </a>
                            </span>
                        )}
                        {devpostProfile.links?.website && (
                            <span className="flex items-center">
                                <Link className="h-3.5 w-3.5 mr-1" />
                                <a
                                    href={devpostProfile.links.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    Website
                                </a>
                            </span>
                        )}
                        {devpostProfile.links?.twitter && (
                            <span className="flex items-center">
                                <Twitter className="h-3.5 w-3.5 mr-1" />
                                <a
                                    href={devpostProfile.links.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline"
                                >
                                    Twitter
                                </a>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-4 text-center">
                <div>
                    <p className="text-lg font-semibold">
                        {devpostProfile.stats.projectCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Projects</p>
                </div>
                <div>
                    <p className="text-lg font-semibold">
                        {devpostProfile.stats.hackathonCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Hackathons</p>
                </div>
                <div>
                    <p className="text-lg font-semibold">
                        {devpostProfile.stats.winCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                </div>
                <div>
                    <p className="text-lg font-semibold">
                        {devpostProfile.achievements.firstPlaceWins}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        First Places
                    </p>
                </div>
            </div>

            {/* Skills and Interests */}
            {(devpostProfile.skills?.length > 0 ||
                devpostProfile.interests?.length > 0) && (
                <>
                    <Separator className="my-4" />

                    <div className="space-y-3">
                        {devpostProfile.skills?.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-2">Skills</h4>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {devpostProfile.skills.map(
                                        (skill, index) => (
                                            <Badge
                                                key={index}
                                                variant="secondary"
                                            >
                                                {skill}
                                            </Badge>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                        {devpostProfile.interests?.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-2">Interests</h4>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {devpostProfile.interests.map(
                                        (interest, index) => (
                                            <Badge
                                                key={index}
                                                variant="outline"
                                            >
                                                {interest}
                                            </Badge>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <Separator className="my-4" />

            <h4 className="font-medium mb-3">Hackathon History</h4>
            <div className="space-y-4">
                {!devpostProfile.projectsAndHackathons ||
                devpostProfile.projectsAndHackathons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No hackathons found
                    </p>
                ) : (
                    devpostProfile.projectsAndHackathons
                        .slice(0, 5)
                        .map((entry, index) => (
                            <div key={index} className="border-t pt-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-medium">
                                            {entry.hackathon && (
                                                <a
                                                    href={
                                                        entry.hackathon_link ||
                                                        `https://devpost.com/hackathons/`
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                >
                                                    {entry.hackathon}
                                                </a>
                                            )}
                                        </h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            <a
                                                href={entry.project_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline"
                                            >
                                                {entry.project}
                                            </a>
                                            {entry.year && (
                                                <span className="ml-2">
                                                    ({entry.year})
                                                </span>
                                            )}
                                        </p>

                                        {/* Project description */}
                                        {entry.description && (
                                            <p className="text-sm mt-1 line-clamp-2">
                                                {entry.description}
                                            </p>
                                        )}

                                        {/* Team members */}
                                        {entry.members &&
                                            entry.members.length > 0 && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Team:{" "}
                                                    {entry.members.join(", ")}
                                                </p>
                                            )}

                                        {/* Technologies used */}
                                        {entry.technologies &&
                                            entry.technologies.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {entry.technologies
                                                        .slice(0, 3)
                                                        .map(
                                                            (
                                                                tech,
                                                                techIndex
                                                            ) => (
                                                                <Badge
                                                                    key={
                                                                        techIndex
                                                                    }
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    {tech}
                                                                </Badge>
                                                            )
                                                        )}
                                                    {entry.technologies.length >
                                                        3 && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            +
                                                            {entry.technologies
                                                                .length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                    {/* Win badge */}
                                    {entry.win && entry.win !== "no" && (
                                        <Badge variant="success">
                                            {entry.win === "yes"
                                                ? "Winner"
                                                : entry.win}
                                        </Badge>
                                    )}
                                </div>

                                {/* Additional project details */}
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {/* GitHub link */}
                                    {entry.github_link && (
                                        <a
                                            href={entry.github_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs flex items-center text-muted-foreground hover:text-primary"
                                        >
                                            <Github className="h-3 w-3 mr-1" />
                                            View Code
                                        </a>
                                    )}

                                    {/* Prizes won */}
                                    {entry.prizes &&
                                        entry.prizes.length > 0 && (
                                            <div className="mt-2 w-full">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    Prizes:
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {entry.prizes.map(
                                                        (prize, prizeIndex) => (
                                                            <Badge
                                                                key={prizeIndex}
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                {prize.prize_text.replace(
                                                                    /^Winner/,
                                                                    ""
                                                                )}
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    {/* Hackathon details expandable section */}
                                    {entry.hackathon_details &&
                                        entry.hackathon_details.description && (
                                            <details className="text-xs w-full mt-1">
                                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                                    Hackathon details
                                                </summary>
                                                <div className="mt-2 pl-2 border-l-2 border-muted">
                                                    <p>
                                                        {
                                                            entry
                                                                .hackathon_details
                                                                .description
                                                        }
                                                    </p>
                                                    {entry.hackathon_details
                                                        .deadline &&
                                                        entry.hackathon_details
                                                            .deadline !==
                                                            "No Deadline Info" && (
                                                            <p className="mt-1">
                                                                Deadline:{" "}
                                                                {
                                                                    entry
                                                                        .hackathon_details
                                                                        .deadline
                                                                }
                                                            </p>
                                                        )}
                                                </div>
                                            </details>
                                        )}
                                </div>
                            </div>
                        ))
                )}
                {devpostProfile.projectsAndHackathons &&
                    devpostProfile.projectsAndHackathons.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center">
                            +{devpostProfile.projectsAndHackathons.length - 5}{" "}
                            more projects
                        </p>
                    )}
            </div>

            {/* Update achievements section */}
            {devpostProfile.achievements && (
                <>
                    <Separator className="my-4" />
                    <h4 className="font-medium mb-3">Achievements</h4>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-2 bg-muted rounded-md">
                            <p className="text-lg font-semibold">
                                {devpostProfile.achievements.totalWins || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Total Wins
                            </p>
                        </div>
                        <div className="p-2 bg-muted rounded-md">
                            <p className="text-lg font-semibold">
                                {devpostProfile.achievements.firstPlaceWins ||
                                    0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                First Place Wins
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* Update yearly participation section */}
            {devpostProfile.hackathons?.participationByYear &&
                Object.keys(devpostProfile.hackathons.participationByYear)
                    .length > 0 && (
                    <>
                        <Separator className="my-4" />
                        <h4 className="font-medium mb-3">
                            Yearly Participation
                        </h4>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(
                                devpostProfile.hackathons.participationByYear
                            )
                                .sort(
                                    ([yearA], [yearB]) =>
                                        Number(yearB) - Number(yearA)
                                )
                                .map(([year, count]) => (
                                    <div
                                        key={year}
                                        className="text-center px-3 py-2 bg-muted rounded-md"
                                    >
                                        <p className="font-medium">{year}</p>
                                        <p className="text-sm">
                                            {count}{" "}
                                            {count === 1
                                                ? "hackathon"
                                                : "hackathons"}
                                        </p>
                                    </div>
                                ))}
                        </div>
                    </>
                )}
        </div>
    );
}

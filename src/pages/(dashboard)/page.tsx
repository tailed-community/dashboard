import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    BriefcaseBusiness,
    User,
    TrendingUp,
    CheckCircle2,
    Circle,
    ArrowRight,
    Clock,
    Upload,
    GitBranch,
    FileText,
    Award,
    Linkedin,
    Globe,
} from "lucide-react";
import { apiFetch } from "@/lib/fetch";

export default function Page() {
    const [scrolled, setScrolled] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 30);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await apiFetch("/profile");
                if (response.ok) {
                    const data = await response.json();
                    setProfileData(data);
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const profileScore = profileData?.profileScore || {
        score: 0,
        completed: {
            githubUsername: false,
            github: false,
            devpostUsername: false,
            devpost: false,
            resume: false,
            skills: false,
            linkedinUrl: false,
            portfolioUrl: false,
        },
    };

    const totalJobsApplied = profileData?.appliedJobs?.length || 0;

    const incompleteTasks = Object.entries(profileScore.completed)
        .filter(([_, isComplete]) => !isComplete)
        .map(([key]) => {
            const taskNames: Record<string, string> = {
                githubUsername: "Add GitHub Username",
                github: "Connect GitHub Profile",
                devpostUsername: "Add Devpost Username",
                devpost: "Verify Devpost Profile",
                resume: "Upload Resume",
                skills: "Add Skills",
                linkedinUrl: "Add LinkedIn URL",
                portfolioUrl: "Add Portfolio URL",
            };
            return taskNames[key] || key;
        });

    // Helper function to convert Firestore timestamp to readable time ago
    const getTimeAgo = (timestamp: any) => {
        if (!timestamp) return "";

        let date;
        if (timestamp._seconds) {
            // Firestore timestamp
            date = new Date(
                timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000
            );
        } else if (typeof timestamp === "string") {
            date = new Date(timestamp);
        } else {
            return "";
        }

        const now = Date.now();
        const diffMs = now - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const diffWeeks = Math.floor(diffMs / 604800000);
        const diffMonths = Math.floor(diffMs / 2592000000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60)
            return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
        if (diffHours < 24)
            return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffWeeks < 4)
            return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
        if (diffMonths < 12)
            return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
        return date.toLocaleDateString();
    };

    // Generate recent activity timeline with actual timestamps
    const recentActivity = [];

    if (profileData?.resume?.uploadedAt) {
        const timestamp = profileData.resume.uploadedAt;
        recentActivity.push({
            icon: Upload,
            text: "Resume uploaded",
            time: getTimeAgo(timestamp),
            timestamp: timestamp._seconds || 0,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
        });
    }

    if (profileData?.github?.lastUpdated) {
        const timestamp = profileData.github.lastUpdated;
        recentActivity.push({
            icon: GitBranch,
            text: "GitHub profile connected",
            time: getTimeAgo(timestamp),
            timestamp: timestamp._seconds || 0,
            color: "text-purple-600",
            bgColor: "bg-purple-50",
        });
    }

    if (profileData?.devpost?.lastUpdated) {
        const timestamp = profileData.devpost.lastUpdated;
        recentActivity.push({
            icon: Award,
            text: "Devpost profile verified",
            time: getTimeAgo(timestamp),
            timestamp: timestamp._seconds || 0,
            color: "text-indigo-600",
            bgColor: "bg-indigo-50",
        });
    }

    if (profileData?.appliedJobs && profileData.appliedJobs.length > 0) {
        // Get most recent application
        const sortedApplications = [...profileData.appliedJobs].sort((a, b) => {
            const timeA = a.appliedAt?._seconds || 0;
            const timeB = b.appliedAt?._seconds || 0;
            return timeB - timeA;
        });
        const latestApplication = sortedApplications[0];

        recentActivity.push({
            icon: BriefcaseBusiness,
            text: `Applied to ${totalJobsApplied} job${
                totalJobsApplied > 1 ? "s" : ""
            }`,
            time: getTimeAgo(latestApplication.appliedAt),
            timestamp: latestApplication.appliedAt?._seconds || 0,
            color: "text-green-600",
            bgColor: "bg-green-50",
        });
    }

    if (profileData?.updatedAt) {
        const timestamp = profileData.updatedAt;
        recentActivity.push({
            icon: User,
            text: "Profile updated",
            time: getTimeAgo(timestamp),
            timestamp: timestamp._seconds || 0,
            color: "text-gray-600",
            bgColor: "bg-gray-50",
        });
    }

    if (profileScore.score === 100) {
        recentActivity.push({
            icon: Award,
            text: "Profile 100% complete! 🎉",
            time: "Achievement unlocked",
            timestamp: Date.now() / 1000,
            color: "text-yellow-600",
            bgColor: "bg-yellow-50",
        });
    } else if (profileScore.score >= 75) {
        recentActivity.push({
            icon: TrendingUp,
            text: "Profile 75% complete",
            time: "Keep going!",
            timestamp: Date.now() / 1000,
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
        });
    }

    // Sort by timestamp (most recent first)
    recentActivity.sort((a, b) => b.timestamp - a.timestamp);

    return (
        <>
            <header
                className={`sticky top-0 z-[50] bg-white flex h-16 shrink-0 items-center gap-2 ${
                    scrolled ? "shadow-sm" : ""
                }`}
            >
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbPage>Dashboard</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
                {/* Welcome Section */}
                <div className="mt-4">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Welcome back, {profileData?.firstName || "Student"}!
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Here's an overview of your profile and activity
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Profile Completeness Card */}
                    <Card className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">
                                Profile
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {profileScore.score}%
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {(() => {
                                            const remaining =
                                                8 -
                                                Object.values(
                                                    profileScore.completed
                                                ).filter(Boolean).length;
                                            return `${remaining} ${
                                                remaining === 1
                                                    ? "item"
                                                    : "items"
                                            } remaining`;
                                        })()}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    {Array.from({ length: 8 }).map((_, i) => {
                                        const completed = Object.values(
                                            profileScore.completed
                                        ).filter(Boolean).length;
                                        return (
                                            <div
                                                key={i}
                                                className={`w-1.5 h-12 rounded-full ${
                                                    i < completed
                                                        ? "bg-green-500"
                                                        : "bg-gray-300"
                                                }`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Jobs Applied Card */}
                    <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">
                                Jobs Applied
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {totalJobsApplied}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Total applications
                                    </p>
                                </div>
                                <BriefcaseBusiness className="h-8 w-8 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account Status Card */}
                    {/* <Card className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">
                                Account Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Badge
                                        className={
                                            profileCompleteness.score === 100
                                                ? "bg-green-600"
                                                : "bg-yellow-600"
                                        }
                                    >
                                        {profileCompleteness.score === 100
                                            ? "Complete"
                                            : "Incomplete"}
                                    </Badge>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {profileCompleteness.score === 100
                                            ? "All set up!"
                                            : "Finish setting up your profile"}
                                    </p>
                                </div>
                                <User className="h-8 w-8 text-purple-500" />
                            </div>
                        </CardContent>
                    </Card> */}
                </div>

                {/* Action Items Section */}
                {!isLoading && incompleteTasks.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">
                                Complete Your Profile
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Finish these steps to increase your chances of
                                getting hired by{" "}
                                <span className="font-bold text-green-600">
                                    83%
                                </span>
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {incompleteTasks.slice(0, 5).map((task, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Circle className="h-4 w-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-900">
                                                {task}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Link to="/account">
                                <Button
                                    className="w-full mt-4 bg-black text-white hover:bg-gray-800"
                                    variant="default"
                                >
                                    Go to Profile
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {/* Recent Activity Timeline */}
                {!isLoading && recentActivity.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Recent Activity
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Track your progress and recent updates
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivity
                                    .slice(0, 6)
                                    .map((activity, i) => {
                                        const Icon = activity.icon;
                                        return (
                                            <div
                                                key={i}
                                                className="flex items-start gap-4"
                                            >
                                                <div
                                                    className={`${activity.bgColor} p-2 rounded-lg shrink-0`}
                                                >
                                                    <Icon
                                                        className={`h-4 w-4 ${activity.color}`}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {activity.text}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {activity.time}
                                                    </p>
                                                </div>
                                                {i <
                                                    recentActivity.slice(0, 6)
                                                        .length -
                                                        1 && (
                                                    <div className="absolute left-[27px] top-full h-4 w-0.5 bg-gray-200" />
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <Link to="/jobs">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <BriefcaseBusiness className="h-5 w-5 text-blue-600" />
                                    Browse Jobs
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600">
                                    Explore available job opportunities and
                                    apply to positions that match your skills
                                </p>
                                <Button
                                    variant="link"
                                    className="mt-2 p-0 h-auto text-blue-600"
                                >
                                    View all jobs
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <Link to="/jobs/applied">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-purple-600" />
                                    My Applications
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600">
                                    Track your job applications and see their
                                    current status
                                </p>
                                <Button
                                    variant="link"
                                    className="mt-2 p-0 h-auto text-purple-600"
                                >
                                    View applications
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <Link to="/account">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <User className="h-5 w-5 text-green-600" />
                                    My Profile
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600">
                                    View and edit your profile, manage your
                                    resume, and connect your accounts
                                </p>
                                <Button
                                    variant="link"
                                    className="mt-2 p-0 h-auto text-green-600"
                                >
                                    Go to profile
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>
                </div>
            </div>
        </>
    );
}

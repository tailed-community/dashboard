import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  Github,
  Award,
  Link as LinkIcon,
  FileText,
  User,
  Trophy,
} from "lucide-react";
import GithubProfileCard from "@/components/github/GithubProfileCard";
import DevpostProfileCard from "@/components/devpost/DevpostProfileCard";
import { CandidateData } from "./types";
import { SidebarContextProvider } from "@/contexts/sidebar-context";

export default function CandidateDetailsPage() {
  const { jobId, candidateId } = useParams();
  const [applicant, setApplicant] = useState<CandidateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function fetchApplicant() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiFetch(
          `/jobs/${jobId}/applicants/${candidateId}`
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to fetch applicant details"
          );
        }

        const data = await response.json();
        setApplicant(data);
      } catch (err) {
        console.error("Error fetching applicant details:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching applicant details"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchApplicant();
  }, [jobId, candidateId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Candidate Details</h1>
        </div>
      </header>
      <div className="p-4 lg:p-6">
        {/* Applicant Header Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {applicant?.profileData?.github?.avatarUrl ? (
                  <AvatarImage src={applicant.profileData.github.avatarUrl} />
                ) : applicant?.githubUsername ? (
                  <AvatarImage
                    src={`https://github.com/${applicant.githubUsername}.png`}
                  />
                ) : (
                  <AvatarFallback>{applicant?.initials || ""}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <CardTitle>
                  {applicant?.name ||
                    `${applicant?.firstName || ""} ${applicant?.lastName || ""}`}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <CardDescription>{applicant?.email}</CardDescription>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-blue-50 text-blue-700 hover:bg-blue-50"
                  >
                    {applicant?.status || "Applied"}
                  </Badge>
                  <Badge variant="outline">
                    Applied on{" "}
                    {new Date(
                      applicant?.appliedAt || ""
                    ).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content with Tabs */}
        <Tabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-6"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="github" className="flex items-center">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </TabsTrigger>
            <TabsTrigger value="devpost" className="flex items-center">
              <Award className="mr-2 h-4 w-4" />
              Hackathons
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">Name</dt>
                      <dd className="font-medium">
                        {applicant?.name ||
                          `${applicant?.firstName || ""} ${applicant?.lastName || ""}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Email</dt>
                      <dd className="font-medium">{applicant?.email}</dd>
                    </div>
                    {applicant?.phone && (
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          Phone
                        </dt>
                        <dd className="font-medium">{applicant.phone}</dd>
                      </div>
                    )}
                    {applicant?.university && (
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          Education
                        </dt>
                        <dd className="font-medium">
                          {applicant.university}
                        </dd>
                        <dd className="text-sm">
                          {applicant.major}, Class of{" "}
                          {applicant.graduationYear}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Social Links & Profiles */}
              <Card>
                <CardHeader>
                  <CardTitle>Profiles & Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {applicant?.githubUsername && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Github className="h-5 w-5 text-muted-foreground" />
                          <span>GitHub</span>
                        </div>
                        <a
                          href={`https://github.com/${applicant.githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          @{applicant.githubUsername}
                        </a>
                      </div>
                    )}
                    {applicant?.devpostUsername && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-muted-foreground" />
                          <span>Devpost</span>
                        </div>
                        <a
                          href={`https://devpost.com/${applicant.devpostUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          @{applicant.devpostUsername}
                        </a>
                      </div>
                    )}
                    {applicant?.linkedinUrl && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-5 w-5 text-muted-foreground" />
                          <span>LinkedIn</span>
                        </div>
                        <a
                          href={applicant.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          View Profile
                        </a>
                      </div>
                    )}
                    {applicant?.portfolioUrl && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-muted-foreground" />
                          <span>Portfolio</span>
                        </div>
                        <a
                          href={applicant.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          View Website
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Application Summary */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Cover Letter</CardTitle>
                </CardHeader>
                <CardContent>
                  {applicant?.coverLetter ? (
                    <div className="whitespace-pre-line text-sm">
                      {applicant.coverLetter}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No cover letter provided
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Key Metrics at a Glance */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Key Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-muted rounded-lg p-4 text-center">
                      <Github className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-lg font-bold">
                        {applicant?.profileData?.github?.contributionCount ||
                          0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        GitHub Contributions
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-center">
                      <Award className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-lg font-bold">
                        {applicant?.profileData?.devpost?.stats
                          ?.hackathonCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Hackathons
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-center">
                      <Trophy className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-lg font-bold">
                        {applicant?.profileData?.devpost?.stats?.winCount ||
                          0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Hackathon Wins
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-center">
                      <Code className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-lg font-bold">
                        {applicant?.profileData?.github?.topLanguages?.[0] ||
                          "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Top Language
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GitHub Tab */}
          <TabsContent value="github">
            <GithubProfileCard profile={applicant?.profileData?.github} />
          </TabsContent>

          {/* Devpost Tab */}
          <TabsContent value="devpost">
            <DevpostProfileCard profile={applicant?.profileData?.devpost} />
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-between">
          <Button asChild variant="outline">
            <Link to={`/jobs/${jobId}`}>Back to Candidates</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline">Reject</Button>
            <Button>Move to Interview</Button>
          </div>
        </div>
      </div>
    </>
  );
}

// Import a Trophy icon component that's not defined above
// function Trophy(props: React.ComponentProps<typeof Award>) {
//   return <Award {...props} />;
// }

// Import a Code icon component that's not defined above
function Code(props: React.ComponentProps<typeof Github>) {
  return <Github {...props} />;
}

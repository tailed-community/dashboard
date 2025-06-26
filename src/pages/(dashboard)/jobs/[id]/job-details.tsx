import { useParams } from "react-router-dom";
import { Upload, Share2, Copy, Globe, Lock, Link2, Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/file-upload";
import { apiFetch } from "@/lib/fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase,
  MapPin,
  Calendar as CalendarIcon,
  Users,
  Settings,
  FileText,
} from "lucide-react";
import { ApplicantStats } from "./components/applicant-stats";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Job } from "@/types/jobs";
import { JobForm, JobFormData } from "@/components/JobForm";

interface Applicant {
  id: string;
  name: string;
  date: string;
  status: "Sent" | "Opened" | "Completed";
  initials: string;
  match?: number;
  skills?: string[];
}

interface RecommendedProfile {
  id: string;
  name: string;
  match: number;
  skills: string[];
  initials: string;
}

export default function JobDetails({ job }: { job?: Job }) {
  const { id } = useParams<{ id: string }>();
  const [jobState, setJob] = useState<Job | null>(job || null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [recommendedProfiles, setRecommendedProfiles] = useState<
    RecommendedProfile[]
  >([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Job>>({});
  const [applicantStats, setApplicantStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareVisibility, setShareVisibility] = useState<
    "restricted" | "link" | "public"
  >("restricted");
  const [shareLink, setShareLink] = useState<string>("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDeleteErrorOpen, setIsDeleteErrorOpen] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    async function fetchJobData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch job details
        if (!jobState) {
          const jobResponse = await apiFetch(`/jobs/${id}`);
          if (!jobResponse.ok) throw new Error("Failed to fetch job details");
          const jobData = await jobResponse.json();
          setJob(jobData);
        }

        // Fetch applicants
        const applicantsResponse = await apiFetch(`/jobs/${id}/applicants`);
        if (!applicantsResponse.ok)
          throw new Error("Failed to fetch applicants");
        const applicantsData = await applicantsResponse.json();
        setApplicants(applicantsData);

        // Calculate recommended profiles from the top 5 applicants based on match percentage
        const recommendedApplicants = [...applicantsData]
          .filter((applicant) => applicant.match !== undefined) // Filter out applicants without match score
          .sort((a, b) => (b.match || 0) - (a.match || 0)) // Sort by match percentage (descending)
          .slice(0, 5); // Take top 5

        // Convert applicants to recommended profiles format
        const recommendedData = recommendedApplicants.map((applicant) => ({
          id: applicant.id,
          name: applicant.name,
          match: applicant.match || 0,
          skills: applicant.skills || [],
          initials: applicant.initials,
        }));

        setRecommendedProfiles(recommendedData);

        // Fetch applicant stats using the new statistics endpoint
        setIsLoadingStats(true);
        const statsResponse = await apiFetch(`/jobs/${id}/statistics`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setApplicantStats(statsData);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
        console.error(err);
      } finally {
        setLoading(false);
        setIsLoadingStats(false);
      }
    }

    if (id) {
      fetchJobData();
    }
  }, [id, jobState]);

  async function handleImportApplicants(file: File) {
    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            // Extract base64 data (remove the data URL prefix)
            const base64 = reader.result.split(",")[1];
            resolve(base64);
          } else {
            reject(new Error("Failed to convert file to base64"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const response = await apiFetch(`/jobs/${id}/import-applicants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          data: base64Data,
        }),
      });

      if (!response.ok) throw new Error("Failed to import applicants");

      // Refresh applicants list
      const updatedApplicantsResponse = await apiFetch(
        `/jobs/${id}/applicants`
      );
      if (!updatedApplicantsResponse.ok)
        throw new Error("Failed to fetch updated applicants");
      const updatedApplicants = await updatedApplicantsResponse.json();
      setApplicants(updatedApplicants);

      setIsImportDialogOpen(false);
    } catch (err) {
      console.error("Error importing applicants:", err);
      alert(err instanceof Error ? err.message : "Failed to import applicants");
    }
  }

  function openEditDialog() {
    if (jobState) {
      setEditFormData({
        title: jobState.title,
        type: jobState.type,
        location: jobState.location,
        status: jobState.status,
        description: jobState.description || "",
        requirements: jobState.requirements || "",
        salary: jobState.salary ? { ...jobState.salary } : { min: undefined, max: undefined },
        postingDate: jobState.postingDate || undefined,
        endPostingDate: jobState.endPostingDate || undefined,
        startDate: jobState.startDate || undefined,
        endDate: jobState.endDate || undefined,
      });
    }
    setIsEditDialogOpen(true);
  }

  function handleDownload() {
    const csvContent = "email\nalice@example.com\nbob@example.com\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "applicant_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Function to construct the share link based on visibility and token
  function constructShareLink(job: Job): string {
    // For jobs shared with a specific link, use the query parameter format
    if (jobState && jobState.visibility === "link" && job.publicToken) {
      return `${window.location.origin}/public/jobs/${jobState.id}?sharedId=${job.publicToken}`;
    }

    // For public jobs or fallback, use the direct path format
    return `${window.location.origin}/public/jobs/${jobState?.id || id}`;
  }

  async function generateShareLink(
    visibility: "restricted" | "link" | "public"
  ) {
    try {
      setShareVisibility(visibility);

      const response = await apiFetch(`/jobs/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate share link");
      }

      const data = await response.json();

      // Update job state with new visibility and token

      const _job = jobState;
      if (_job) {
        _job.visibility = visibility;
        _job.publicToken = data.token;

        setJob(_job);

        if (visibility !== "restricted") {
          // Pass updated visibility to ensure correct URL format
          const shareUrl = constructShareLink(_job);
          setShareLink(shareUrl);
        } else {
          setShareLink("");
        }
      }
    } catch (err) {
      console.error("Error generating share link:", err);
    }
  }

  // Initialize share dialog with current job state
  function openShareDialog() {
    if (jobState) {
      // Set initial visibility from job state or default to restricted
      const currentVisibility = jobState.visibility || "restricted";
      setShareVisibility(currentVisibility);

      // Reconstruct share link if public token exists
      if (jobState.publicToken && currentVisibility !== "restricted") {
        setShareLink(constructShareLink(jobState));
      } else {
        setShareLink("");
      }
    }

    setIsShareDialogOpen(true);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);

      // Reset success message after 2 seconds
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  if (loading)
    return (
      <div className="w-full max-w-5xl mx-auto p-4">Loading job details...</div>
    );
  if (error)
    return (
      <div className="w-full max-w-5xl mx-auto p-4 text-red-500">
        Error: {error}
      </div>
    );
  if (!jobState)
    return <div className="w-full max-w-5xl mx-auto p-4">Job not found</div>;

  return (
    <Tabs
      defaultValue="details"
      className="w-full max-w-5xl mx-auto p-4 space-y-6"
    >
      <TabsList className="mb-4">
        <TabsTrigger value="details">
          <FileText className="h-4 w-4 mr-2" />
          Job Details
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold">{jobState.title}</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Briefcase className="h-3 w-3" />
                      {jobState.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <MapPin className="h-3 w-3" />
                      {jobState.location}
                    </Badge>
                    <Badge
                      variant={
                        jobState.status === "Active" ? "default" : "secondary"
                      }
                    >
                      {jobState.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog
                    open={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Import Applicants
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Applicants</DialogTitle>
                        <DialogDescription>
                          Upload a CSV or TXT file containing email addresses
                          (one per line) to invite applicants.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <p className="text-sm text-muted-foreground">
                            Need a template?
                          </p>
                          <Button
                            variant="outline"
                            onClick={handleDownload}
                            className="gap-2"
                            size="sm"
                          >
                            <FileText className="h-4 w-4" />
                            Download CSV Template
                          </Button>
                        </div>
                        <FileUpload
                          onUpload={handleImportApplicants}
                          onClose={() => setIsImportDialogOpen(false)}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    onClick={openShareDialog}
                    className="gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>

                  <Button onClick={openEditDialog}>Edit Job</Button>
                  {/* Edit Job Dialog using shared JobForm */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          Edit Job {editFormData.title ? `"${editFormData.title}"` : ""}
                        </DialogTitle>
                        <DialogDescription>
                          Update the job details below and click Save to apply changes.
                        </DialogDescription>
                      </DialogHeader>
                      <JobForm
                        initialValues={{
                          title: editFormData.title || "",
                          type: editFormData.type || "internship",
                          location: editFormData.location || "",
                          salary: editFormData.salary || { min: undefined, max: undefined },
                          postingDate: editFormData.postingDate ? new Date(editFormData.postingDate as string) : undefined,
                          endPostingDate: editFormData.endPostingDate ? new Date(editFormData.endPostingDate as string) : undefined,
                          startDate: editFormData.startDate ? new Date(editFormData.startDate as string) : undefined,
                          endDate: editFormData.endDate ? new Date(editFormData.endDate as string) : undefined,
                          description: editFormData.description || "",
                          requirements: editFormData.requirements || "",
                          status: (editFormData.status as "Active" | "Draft") || "Draft",
                        }}
                        onSubmit={async (data) => {
                          setLoading(true);
                          try {
                            const response = await apiFetch(`/jobs/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                ...data,
                                postingDate: data.postingDate?.toISOString(),
                                endPostingDate: data.endPostingDate?.toISOString(),
                                startDate: data.startDate?.toISOString(),
                                endDate: data.endDate?.toISOString(),
                              }),
                            });
                            if (!response.ok) throw new Error("Failed to update job");
                            const updatedJob = await response.json();
                            setJob(updatedJob);
                            setIsEditDialogOpen(false);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Failed to update job");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        loading={loading}
                        submitLabel="Save"
                        onCancel={() => setIsEditDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stats row - more compact design */}
              <div className="flex flex-wrap gap-6 py-2">
                <div className="flex items-center">
                  <div className="bg-muted/50 p-2 rounded-md mr-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Applicants</p>
                    <p className="font-semibold">{jobState.applicants}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge
                      variant={
                        jobState.status === "Active" ? "default" : "secondary"
                      }
                    >
                      {jobState.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Collapsible job description */}
              {jobState.description && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium">Job Description</h3>
                    {jobState.description.length > 150 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          const descElem =
                            document.getElementById("job-description");
                          if (descElem) {
                            descElem.classList.toggle("line-clamp-3");
                            const btn =
                              descElem.nextElementSibling?.querySelector(
                                "button"
                              );
                            if (btn) {
                              btn.textContent = descElem.classList.contains(
                                "line-clamp-3"
                              )
                                ? "Read more"
                                : "Show less";
                            }
                          }
                        }}
                      >
                        Read more
                      </Button>
                    )}
                  </div>
                  <div
                    id="job-description"
                    className="text-sm text-muted-foreground line-clamp-3"
                  >
                    {jobState.description}
                  </div>
                </div>
              )}

              {/* Delete Job Button - bottom right */}
              <div className="flex justify-end mt-8">
                <Button
                  className="bg-red-600 text-white hover:bg-red-800 h-10 px-4 border-none"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
                      try {
                        const response = await apiFetch(`/jobs/${id}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Failed to delete job');
                        window.location.href = '/jobs';
                      } catch (err) {
                        setDeleteErrorMsg(err instanceof Error ? err.message : 'Failed to delete job');
                        setIsDeleteErrorOpen(true);
                      }
                    }
                  }}
                >
                  Delete Job
                </Button>

                {/* Error Dialog for Delete Job */}
                <Dialog open={isDeleteErrorOpen} onOpenChange={setIsDeleteErrorOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Unable to Delete Job<br />
                        <span className="block text-base text-gray-500 font-normal">Please Try Again</span>
                      </DialogTitle>
                      <DialogDescription>
                        {/* Removed duplicate error message here */}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm text-gray-400">Error: {deleteErrorMsg}</span>
                      <Button onClick={() => setIsDeleteErrorOpen(false)} autoFocus>OK</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Applicant Analytics Section */}
          <Card>
            <CardHeader>
              <CardTitle>Applicant Analytics</CardTitle>
              <CardDescription>
                Insights and statistics about your job applicants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : applicantStats ? (
                <ApplicantStats jobId={jobState.id} stats={applicantStats} />
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                  <h3 className="mt-4 text-lg font-medium">
                    No applicant data available
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    Once you receive applications, analytics will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="settings">
        <Card>
          <CardHeader>
            <CardTitle>Job Settings</CardTitle>
            <CardDescription>
              Manage preferences and options for this job listing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Job settings content would go here.</p>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Sharing Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Job Posting</DialogTitle>
            <DialogDescription>
              Choose how you want to share this job posting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Visibility options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div
                  className={`p-2 rounded-full ${shareVisibility === "restricted" ? "bg-primary/10" : "bg-muted"}`}
                >
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Restricted</h4>
                      <p className="text-sm text-muted-foreground">
                        Only specific people can access
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={
                        shareVisibility === "restricted" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => generateShareLink("restricted")}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div
                  className={`p-2 rounded-full ${shareVisibility === "link" ? "bg-primary/10" : "bg-muted"}`}
                >
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Anyone with the link</h4>
                      <p className="text-sm text-muted-foreground">
                        Anyone with this link can view the job
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={
                        shareVisibility === "link" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => generateShareLink("link")}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div
                  className={`p-2 rounded-full ${shareVisibility === "public" ? "bg-primary/10" : "bg-muted"}`}
                >
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Public on the web</h4>
                      <p className="text-sm text-muted-foreground">
                        Anyone can find and access
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={
                        shareVisibility === "public" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => generateShareLink("public")}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Share link area */}
            {shareLink && (
              <div className="border rounded-md p-2">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    disabled={copySuccess}
                    className="h-8 px-2"
                  >
                    {copySuccess ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {shareVisibility === "restricted" &&
                "Only approved users can access this job"}
              {shareVisibility === "link" &&
                "Anyone with the link can access this job"}
              {shareVisibility === "public" &&
                "This job will be visible to everyone"}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsShareDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

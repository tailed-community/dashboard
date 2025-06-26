import type React from "react";
import { useState, useEffect } from "react";
// import Image from "next/image"
import {
  MoreHorizontal,
  Pencil,
  Upload,
  UserPlus,
  Check,
  X,
  Loader2,
  UserCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import { Skeleton } from "@/components/ui/skeleton";

// API service functions
const apiService = {
  getOrganization: async () => {
    try {
      const response = await apiFetch("/organization");
      if (!response.ok) throw new Error("Failed to fetch organization");
      return await response.json();
    } catch (error) {
      console.error("Error fetching organization:", error);
      throw error;
    }
  },
  updateOrganizationName: async (name: string) => {
    try {
      const response = await apiFetch("/organization/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Failed to update organization name");
      return await response.json();
    } catch (error) {
      console.error("Error updating organization name:", error);
      throw error;
    }
  },
  updateOrganizationLogo: async (logoFile: File) => {
    try {
      // Convert file to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(logoFile);
        reader.onload = () => {
          const base64Image = reader.result?.toString(); // Remove data URL prefix

          console.log("Base64 Image:", base64Image); // Debugging line

          apiFetch("/organization/update-logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Image }),
          })
            .then((response) => {
              if (!response.ok)
                throw new Error("Failed to update organization logo");
              return response.json();
            })
            .then((data) => resolve(data))
            .catch((error) => reject(error));
        };
        reader.onerror = (error) => reject(error);
      });
    } catch (error) {
      console.error("Error updating organization logo:", error);
      throw error;
    }
  },
  getMembers: async () => {
    try {
      const response = await apiFetch("/organization/members");
      if (!response.ok) throw new Error("Failed to fetch members");
      return await response.json();
    } catch (error) {
      console.error("Error fetching members:", error);
      throw error;
    }
  },
  inviteMember: async (email: string, firstName: string, lastName: string) => {
    try {
      const response = await apiFetch("/organization/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName }),
      });
      if (!response.ok) throw new Error("Failed to invite member");
      return await response.json();
    } catch (error) {
      console.error("Error inviting member:", error);
      throw error;
    }
  },
  updateMemberRole: async (memberId: number, role: string) => {
    try {
      const response = await apiFetch(
        `/organization/members/${memberId}/role`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (!response.ok) throw new Error("Failed to update member role");
      return await response.json();
    } catch (error) {
      console.error("Error updating member role:", error);
      throw error;
    }
  },
  removeMember: async (memberId: number) => {
    try {
      const response = await apiFetch(`/organization/members/${memberId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove member");
      return await response.json();
    } catch (error) {
      console.error("Error removing member:", error);
      throw error;
    }
  },
  getPendingInvites: async () => {
    try {
      const response = await apiFetch("/organization/invites");
      if (!response.ok) throw new Error("Failed to fetch invites");
      return await response.json();
    } catch (error) {
      console.error("Error fetching invites:", error);
      throw error;
    }
  },
};

// Remove mock data and replace with empty states
const initialOrganization = {
  name: "",
  logo: "",
};

const initialMembers: Array<any> = [];

export default function AccountPage() {
  const [organization, setOrganization] = useState(initialOrganization);
  const [student, setStudent] = useState({ name: "", email: "" });
  const [members, setMembers] = useState(initialMembers);
  const [pendingInvites, setPendingInvites] = useState<
    Array<{
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      createdAt: string;
    }>
  >([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberLastName, setNewMemberLastName] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<
    (typeof members)[0] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  // New state for resolved logo URL
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string>("");
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);

  // Resolve Firebase storage path to URL when organization changes
  useEffect(() => {
    const resolveLogo = async () => {
      if (!organization.logo) {
        setResolvedLogoUrl("/placeholder.svg");
        return;
      }

      // Check if the logo is already a full URL (starts with http or data:)
      if (
        organization.logo.startsWith("http") ||
        organization.logo.startsWith("data:")
      ) {
        setResolvedLogoUrl(organization.logo);
        return;
      }

      // Assume it's a Firebase storage path
      try {
        setIsLoadingLogo(true);
        const url = await getFileUrl(organization.logo);
        setResolvedLogoUrl(url);
      } catch (error) {
        console.error("Error resolving logo URL:", error);
        setResolvedLogoUrl("/placeholder.svg");
      } finally {
        setIsLoadingLogo(false);
      }
    };

    resolveLogo();
  }, [organization.logo]);

  useEffect(() => {
    // Fetch data on component mount
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgData, membersData, invitesData] = await Promise.all([
          apiService.getOrganization(),
          apiService.getMembers(),
          apiService.getPendingInvites(),
        ]);
        setOrganization(orgData as any);
        setMembers(membersData as any);
        setPendingInvites(invitesData as any);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Error loading data", {
          description:
            "Could not load organization data. Please try again later.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStudent((prev) => ({ ...prev, [name]: value }));
  };

  const saveStudentChange = async () => {
    setIsLoading(true);
    try {
      // Assume updateStudent is a function to update student details
      await apiService.updateStudent(student);
      toast.success("Student updated", {
        description: "Student details have been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating student:", error);
      toast.error("Error updating student", {
        description: "Could not update student details. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubLogin = () => {
    // Redirect to GitHub OAuth login
    window.location.href = "/auth/github";
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingLogo(true);
      try {
        const result = (await apiService.updateOrganizationLogo(file)) as any;

        // Update organization with the Firebase storage path returned from the API
        // The API should return a Firebase storage path, not a full URL
        setOrganization((prev) => ({ ...prev, logo: result.logo as string }));

        toast.success("Logo updated", {
          description: "Organization logo has been updated successfully.",
        });
      } catch (error) {
        console.error("Error updating logo:", error);
        toast.error("Error updating logo", {
          description: "Could not update organization logo. Please try again.",
        });
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  const handleInviteMember = async () => {
    if (!newMemberEmail || !newMemberFirstName || !newMemberLastName) return;

    setIsInviting(true);
    try {
      const result = (await apiService.inviteMember(
        newMemberEmail,
        newMemberFirstName,
        newMemberLastName,
      )) as any;
      setMembers((prev) => [
        ...prev,
        {
          email: result.email,
          id: result.inviteId,
          name: `${result.firstName} ${result.lastName}`,
          role: "Member",
        },
      ]);
      setNewMemberEmail("");
      setNewMemberFirstName("");
      setNewMemberLastName("");
      setIsInviteDialogOpen(false);
      toast.success("Invitation sent", {
        description: `Invitation email has been sent to ${newMemberEmail}.`,
      });
    } catch (error) {
      console.error("Error inviting member:", error);
      toast.error("Error inviting member", {
        description: "Could not send invitation. Please try again.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: number, newRole: string) => {
    try {
      await apiService.updateMemberRole(memberId, newRole);
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, role: newRole } : member,
        ),
      );
      toast.success("Role updated", {
        description: "Member role has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Error updating role", {
        description: "Could not update member role. Please try again.",
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);
    try {
      await apiService.removeMember(memberToRemove.id);
      setMembers((prev) =>
        prev.filter((member) => member.id !== memberToRemove.id),
      );
      setIsRemoveDialogOpen(false);
      toast.success("Member removed", {
        description: `${memberToRemove.name} has been removed from the organization.`,
      });
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Error removing member", {
        description: "Could not remove the member. Please try again.",
      });
    } finally {
      setIsRemoving(false);
      setMemberToRemove(null);
    }
  };

  // Add a new function to render skeleton UI
  const renderSkeletonContent = () => (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <Skeleton className="w-[100px] h-[100px] rounded-lg" />
            <div className="flex-grow space-y-3">
              <Skeleton className="h-8 w-[200px]" />
              <Skeleton className="h-4 w-[140px]" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-[100px]" />
            <Skeleton className="h-9 w-[120px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-[60px]" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Replace the existing loading check with skeleton UI
  if (isLoading) {
    return renderSkeletonContent();
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="relative flex justify-center items-center">
              {isUploadingLogo || isLoadingLogo ? (
                <div className="w-[100px] h-[100px] rounded-lg bg-muted flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : resolvedLogoUrl ? (
                <img
                  src={resolvedLogoUrl}
                  alt={`${organization.name || "Organization"} logo`}
                  width={100}
                  height={100}
                  className="rounded-lg object-cover border"
                  onError={(e) => {
                    setResolvedLogoUrl(""); // Clear URL to show placeholder instead
                  }}
                />
              ) : (
                <div className="w-[100px] h-[100px] rounded-lg bg-muted flex items-center justify-center border">
                  <UserCircle className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <Label
                htmlFor="logo-upload"
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer shadow-md hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-4 w-4" />
              </Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
                disabled={isUploadingLogo || isLoadingLogo}
              />
            </div>
            <div className="flex-grow space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  name="name"
                  value={student.name}
                  onChange={handleStudentChange}
                  placeholder="Student Name"
                  className="w-full"
                />
                <Input
                  name="email"
                  value={student.email}
                  onChange={handleStudentChange}
                  placeholder="Student Email"
                  className="w-full"
                />
              </div>
              <div className="flex space-x-4 mt-4">
                <Button
                  variant="primary"
                  onClick={saveStudentChange}
                  disabled={isLoading}
                  className="w-full md:w-auto"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleGitHubLogin}
                  className="w-full md:w-auto"
                >
                  Login with GitHub
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

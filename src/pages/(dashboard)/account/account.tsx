import type React from "react";
import { useState, useEffect } from "react";
import { Upload, Loader2, Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch";
import { Skeleton } from "@/components/ui/skeleton";

type StudentProps = {
  email: string;
  studentId: number;
  firstName: string;
  lastName: string;
  phone: string;
  school: string;
  program: string;
  graduationYear: string;
  devpost: string;
  linkedin: string;
};

// API service functions
const apiService = {
  getStudent: async () => {
    try {
      const response = await apiFetch("/profile");
      if (!response.ok) throw new Error("Failed to fetch members");
      return await response.json();
    } catch (error) {
      console.error("Error fetching members:", error);
      throw error;
    }
  },
  updateStudent: async (studentId: string, studentData: StudentProps) => {
    //TODO: If email changes, also update auth tenant
    try {
      const response = await apiFetch(`/profiles/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentData),
      });
      if (!response.ok) throw new Error("Failed to update member role");
      return await response;
    } catch (error) {
      console.error("Error updating member role:", error);
      throw error;
    }
  },
};

export default function AccountPage() {
  const [student, setStudent] = useState({
    id: "",
    email: "",
    studentId: 0,
    firstName: "",
    lastName: "",
    phone: "",
    school: "",
    program: "",
    graduationYear: "",
    linkedin: "",
    devpost: "",
  } as StudentProps);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState({
    name: false,
    email: false,
    phone: false,
    school: false,
    program: false,
    graduationYear: false,
    linkedin: false,
    devpost: false,
  });

  // Resolve Firebase storage path to URL when organization changes
  useEffect(() => {
    // Fetch data on component mount
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const studentData = await apiService.getStudent();
        setStudent(studentData as any);
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

  const handleEditClick = (field: string) => {
    setIsEditing((prev) => ({ ...prev, [field]: true }));
  };

  const saveStudentChange = async (field: string) => {
    setIsEditing((prev) => ({ ...prev, [field]: false }));
    setIsLoading(true);
    try {
      await apiService.updateStudent(student.id, student as StudentProps);
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

  // Add a new function to render skeleton UI
  const renderSkeletonContent = () => (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4 w-full">
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
            <div className="relative">
              {/* TODO: Add profile picture functionality */}
              <img
                src="https://www.placeholderimage.online/images/generic/users-profile.jpg"
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
              />
              <button
                className="absolute bottom-0 right-0 bg-black text-white p-2 rounded-full shadow-md hover:bg-blue-600"
                onClick={() => console.log("Change profile picture clicked")}
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-grow space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="block mb-1">
                    First Name
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="firstName"
                      name="firstName"
                      value={student.firstName}
                      onChange={handleStudentChange}
                      placeholder="First Name"
                      className="w-full"
                      disabled={!isEditing.firstName}
                    />
                    {isEditing.firstName ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("firstName")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("firstName")}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="lastName" className="block mb-1">
                    Last Name
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="lastName"
                      name="lastName"
                      value={student.lastName}
                      onChange={handleStudentChange}
                      placeholder="Last Name"
                      className="w-full"
                      disabled={!isEditing.lastName}
                    />
                    {isEditing.lastName ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("lastName")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("lastName")}
                      />
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="email" className="block mb-1">
                    Email
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="email"
                      name="email"
                      value={student.email}
                      onChange={handleStudentChange}
                      placeholder="Email"
                      className="w-full"
                      disabled={!isEditing.email}
                    />
                    {isEditing.email ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("email")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("email")}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone" className="block mb-1">
                    Phone Number
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="phone"
                      name="phone"
                      value={student.phone}
                      onChange={handleStudentChange}
                      placeholder="Phone Number"
                      className="w-full"
                      disabled={!isEditing.phone}
                    />
                    {isEditing.phone ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("phone")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("phone")}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="school" className="block mb-1">
                    University/College
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="school"
                      name="school"
                      value={student.school}
                      onChange={handleStudentChange}
                      placeholder="University/College"
                      className="w-full"
                      disabled={!isEditing.school}
                    />
                    {isEditing.school ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("school")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("school")}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="program" className="block mb-1">
                    Major/Program
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="program"
                      name="program"
                      value={student.program}
                      onChange={handleStudentChange}
                      placeholder="Major/Program"
                      className="w-full"
                      disabled={!isEditing.program}
                    />
                    {isEditing.program ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("program")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("program")}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="graduationYear" className="block mb-1">
                    Expected Graduation Year
                  </Label>
                  <div className="flex items-center">
                    <Input
                      id="graduationYear"
                      name="graduationYear"
                      value={student.graduationYear}
                      onChange={handleStudentChange}
                      placeholder="Expected Graduation Year"
                      className="w-full"
                      disabled={!isEditing.graduationYear}
                    />
                    {isEditing.graduationYear ? (
                      <Button
                        className="bg-black text-white"
                        onClick={() => saveStudentChange("graduationYear")}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    ) : (
                      <Edit3
                        className="cursor-pointer ml-2"
                        onClick={() => handleEditClick("graduationYear")}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="mt-6 border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold text-gray-800">Connections</h2>
          <p className="text-sm text-gray-500">
            Link your external accounts and profiles.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="linkedin"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                LinkedIn URL
              </Label>
              <div className="flex items-center">
                <Input
                  id="linkedin"
                  name="linkedin"
                  value={student.linkedin || ""}
                  onChange={handleStudentChange}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full border-gray-300 focus:ring-black focus:border-black"
                  disabled={!isEditing.linkedin}
                />
                {isEditing.linkedin ? (
                  <Button
                    className="bg-black text-white ml-2"
                    onClick={() => saveStudentChange("linkedin")}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                ) : (
                  <Edit3
                    className="cursor-pointer ml-2"
                    onClick={() => handleEditClick("linkedin")}
                  />
                )}
              </div>
            </div>
            <div>
              <Label
                htmlFor="devpost"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Devpost Username
              </Label>
              <div className="flex items-center">
                <Input
                  id="devpost"
                  name="devpost"
                  value={student.devpost || ""}
                  onChange={handleStudentChange}
                  placeholder="Devpost Username"
                  className="w-full border-gray-300 focus:ring-black focus:border-black"
                  disabled={!isEditing.devpost}
                />
                {isEditing.devpost ? (
                  <Button
                    className="bg-black text-white ml-2"
                    onClick={() => saveStudentChange("devpost")}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                ) : (
                  <Edit3
                    className="cursor-pointer ml-2"
                    onClick={() => handleEditClick("devpost")}
                  />
                )}
              </div>
              <div className="flex items-center mt-6">
                <Button
                  variant="secondary"
                  onClick={handleGitHubLogin}
                  className="bg-black text-white px-4 py-2 text-sm hover:bg-gray-800"
                >
                  Connect GitHub
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch";
import { JobForm, JobFormData } from "@/components/JobForm";

export default function CreateJob() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const initialFormData: JobFormData = {
    title: "",
    type: "internship",
    location: "",
    salary: { min: undefined, max: undefined },
    postingDate: undefined,
    endPostingDate: undefined,
    startDate: undefined,
    endDate: undefined,
    description: "",
    requirements: "",
    status: "Draft",
  };

  const handleSubmit = async (data: JobFormData) => {
    setIsLoading(true);
    setError("");
    try {
      const jobData = {
        ...data,
        postingDate: data.postingDate?.toISOString(),
        endPostingDate: data.endPostingDate?.toISOString(),
        startDate: data.startDate?.toISOString(),
        endDate: data.endDate?.toISOString(),
      };
      const response = await apiFetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create job");
      }
      navigate("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Job</CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm
            initialValues={initialFormData}
            onSubmit={handleSubmit}
            loading={isLoading}
            error={error}
            submitLabel="Create Job"
            onCancel={() => navigate(-1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

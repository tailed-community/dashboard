import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";
import { type JobData } from "./types";

interface ApplicationConfirmationProps {
  jobData: JobData | null;
  tokenInfo?: {
    applicant: {
      email: string;
    };
  };
}

export default function ApplicationConfirmation({
  jobData,
  tokenInfo,
}: ApplicationConfirmationProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="mx-auto max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-xl">Application Submitted!</CardTitle>
          <CardDescription>
            Thank you for applying to {jobData?.job.title} at{" "}
            {jobData?.organization.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your application has been received. The team will review your
            profile and get back to you soon.
          </p>

          <div className="bg-muted p-4 rounded-lg text-sm">
            {tokenInfo ? (
              <>
                <p>A confirmation email has been sent to:</p>
                <p className="font-medium mt-1">{tokenInfo?.applicant.email}</p>
              </>
            ) : (
              <p>A confirmation email has been sent to your email.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild>
            <Link to="/">
              {/* Return to Dashboard */}
              Return to Home
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

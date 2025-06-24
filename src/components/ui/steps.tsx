import React from "react";
import { cn } from "@/lib/utils";

interface StepProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  isActive?: boolean;
  isCompleted?: boolean;
}

export const Step = ({
  icon,
  title,
  description,
  isActive,
  isCompleted,
}: StepProps) => {
  return (
    <div
      className={cn(
        "flex items-center",
        isActive && "text-primary",
        !isActive && !isCompleted && "text-muted-foreground"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          isActive && "border-primary bg-primary text-primary-foreground",
          isCompleted && "border-primary bg-primary/20 text-primary",
          !isActive && !isCompleted && "border-muted-foreground/30 bg-muted"
        )}
      >
        {icon}
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium leading-none">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};

interface StepsProps {
  currentStep: number;
  children: React.ReactElement<StepProps>[];
  className?: string;
}

export const Steps = ({ currentStep, children, className }: StepsProps) => {
  // Convert React children to array to ensure we can use map
  const steps = React.Children.toArray(
    children
  ) as React.ReactElement<StepProps>[];

  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step, index) => {
        const isActive = currentStep === index;
        const isCompleted = currentStep > index;

        // Clone the element to pass the active and completed states
        return (
          <React.Fragment key={index}>
            {React.cloneElement(step, {
              isActive,
              isCompleted,
            })}
            {index < steps.length - 1 && (
              <div className="ml-4 h-10 w-px bg-border"></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

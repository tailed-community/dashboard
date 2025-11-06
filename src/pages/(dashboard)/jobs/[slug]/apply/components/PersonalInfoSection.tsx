import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ApplicationFormData } from "../types";

interface PersonalInfoSectionProps {
    formData: ApplicationFormData;
    handleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    handleBlur?: (
        e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    validationErrors?: {
        firstName?: string;
        lastName?: string;
        phone?: string;
    };
}

export default function PersonalInfoSection({
    formData,
    handleInputChange,
    handleBlur,
    validationErrors = {},
}: PersonalInfoSectionProps) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">
                        First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        required
                        className={
                            validationErrors.firstName ? "border-red-500" : ""
                        }
                    />
                    {validationErrors.firstName && (
                        <p className="text-sm text-red-500">
                            {validationErrors.firstName}
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">
                        Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        required
                        className={
                            validationErrors.lastName ? "border-red-500" : ""
                        }
                    />
                    {validationErrors.lastName && (
                        <p className="text-sm text-red-500">
                            {validationErrors.lastName}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">
                    Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    required
                    placeholder="+1 (555) 123-4567"
                    className={validationErrors.phone ? "border-red-500" : ""}
                />
                {validationErrors.phone && (
                    <p className="text-sm text-red-500">
                        {validationErrors.phone}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    Enter a valid phone number (10-15 digits)
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="university">University/College</Label>
                    <Input
                        id="university"
                        name="university"
                        value={formData.university}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="major">Major/Program</Label>
                    <Input
                        id="major"
                        name="major"
                        value={formData.major}
                        onChange={handleInputChange}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="graduationYear">Expected Graduation Year</Label>
                <Input
                    id="graduationYear"
                    name="graduationYear"
                    type="number"
                    min="2023"
                    max="2030"
                    value={formData.graduationYear}
                    onChange={handleInputChange}
                    required
                />
            </div>
        </div>
    );
}

import { z } from "zod";

const communityUrlFieldsSchema = z.object({
  websiteUrl: z.string().optional(),
  discordUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
});

const communityCoreSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be less than 100 characters"),
  shortDescription: z.string().min(10, "Short description must be at least 10 characters").max(200, "Short description must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description must be less than 5000 characters"),
  category: z.string().min(1, "Category is required"),
});

export const createCommunityFormSchema = communityCoreSchema.extend({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  ...communityUrlFieldsSchema.shape,
  logo: z.instanceof(File).optional(),
  banner: z.instanceof(File).optional(),
});

export const updateCommunityFormSchema = communityCoreSchema.partial({
  shortDescription: true,
}).extend({
  ...communityUrlFieldsSchema.shape,
});

export type CreateCommunityFormData = z.infer<typeof createCommunityFormSchema>;
export type UpdateCommunityFormData = z.infer<typeof updateCommunityFormSchema>;

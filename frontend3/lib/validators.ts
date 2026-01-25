// lib/validators.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = loginSchema.extend({
  username: z.string().min(3, "Username is required").optional(),
  full_name: z.string().min(2, "Name is required"),
  age: z.coerce.number().min(18, "You must be at least 18 years old"),
  gender: z.enum(["male", "female", "other"]),
});

export const groupSchema = z.object({
  title: z.string().min(5, "Title too short"),
  description: z.string().min(20, "Please provide more detail"),
  activity_type: z.string().min(1, "Required"),
  category: z.enum(["mutual_benefits", "friendship", "dating"]),
  location: z.string().min(1, "Location required"),
  location_lat: z.coerce.number().optional(),
  location_lng: z.coerce.number().optional(),
  cost_type: z.enum(["free", "shared", "fully_paid", "custom"]),
  min_participants: z.coerce.number().min(1).default(1),
  max_participants: z.coerce.number().min(1),
  offerings: z
    .string()
    .min(1, "List at least two offers")
    .refine(
      (value) => value.split(",").map((item) => item.trim()).filter(Boolean).length >= 2,
      "List at least two offers"
    ),
  expectations: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  creator_intro: z.string().optional(),
  creator_intro_video_url: z.union([z.string().url(), z.literal("")]).optional(),
  requirements: z.array(z.object({
    applies_to: z.enum(["male", "female", "other", "all"]),
    min_age: z.coerce.number().min(18),
    max_age: z.coerce.number(),
    // FIXED: Added z.string() as the first argument for the record key
    consent_flags: z.record(z.string(), z.boolean())
  })).min(1, "At least one requirement is needed")
});

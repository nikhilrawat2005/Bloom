import { z } from "zod";

export const usernameRegex = /^[a-z0-9_]{3,20}$/;

export const loginSchema = z.object({
  identifier: z.string().min(3, "Enter your email or username"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be 3-20 characters")
    .max(20, "Username must be 3-20 characters")
    .regex(usernameRegex, "Only lowercase letters, numbers and underscore allowed"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const googleCompleteSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be 3-20 characters")
    .max(20, "Username must be 3-20 characters")
    .regex(usernameRegex, "Only lowercase letters, numbers and underscore allowed"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  bio: z.string().optional(),
  education: z.string().min(1, "Education is required"),
  skills: z.string().min(1, "Enter at least one skill"),
  interests: z.string().min(1, "Enter at least one interest"),
  location: z.string().min(1, "Location is required"),
  categories: z.array(z.string()).min(1, "Select at least one preferred category"),
});

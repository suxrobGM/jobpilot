import { z } from "zod/v4";

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const ApiTokenCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ApiTokenCreateInput = z.infer<typeof ApiTokenCreateSchema>;

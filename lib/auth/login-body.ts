import { z } from "zod";

export const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
});

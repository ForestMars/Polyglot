import { z } from "zod";

export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;


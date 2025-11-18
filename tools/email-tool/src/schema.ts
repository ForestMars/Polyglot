import { z } from "zod";

export const sendEmailSchema = z.object({
  to: z.union([
    z.string().email(), // single recipient
    z.array(z.string().email()).min(1), // or multiple
  ]),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// email-tool/src/schema.ts
import { z } from 'zod';

export const sendEmailSchema = z.object({
  to: z.union([
    z.string().min(1), // Accept any string - contacts service will resolve
    z.array(z.string().min(1)).min(1)
  ]),
  subject: z.string().min(1),
  body: z.string().min(1)
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
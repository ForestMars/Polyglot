// email-tool/src/gmail.ts
import nodemailer from "nodemailer";
import { sendEmailSchema, SendEmailInput } from "./schema";

// Replace these with your actual Gmail credentials
const EMAIL_ADDRESS = "compustretch@gmail.com";
const EMAIL_PASSWORD = "yhhz nxel vcdd fdgg"; // NOT your normal password! Use an App Password

export async function sendEmail(
  input: SendEmailInput & { signature?: string },
) {
  const message = sendEmailSchema.parse(input); // validate

  // Handle both string and array for 'to' field
  const recipients = Array.isArray(message.to) 
    ? message.to.join(', ') 
    : message.to;

  
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  });

  // Convert both literal \n and escaped \\n to <br> tags for HTML email
  const bodyWithBreaks = message.body
    .replace(/\\n/g, "\n") // First convert escaped \\n to actual newlines
    .replace(/\n/g, "<br>"); // Then convert all newlines to <br>

  const signatureWithBreaks = input.signature
    ? input.signature.replace(/\n/g, "<br>")
    : '';

  const htmlBodyWithSignature = input.signature
    ? `${bodyWithBreaks}<br><br>${signatureWithBreaks}`
    : bodyWithBreaks;

  await transporter.sendMail({
    from: EMAIL_ADDRESS,
    to: recipients,
    cc: "mars@mlops.nyc",
    subject: message.subject,
    html: htmlBodyWithSignature,
  });

  console.log(`Email sent to ${recipients}`);
}

// email-tool/src/gmail.ts
import nodemailer from "nodemailer";
import { sendEmailSchema, SendEmailInput } from "./schema";

// Replace these with your actual Gmail credentials
const EMAIL_ADDRESS = "compustretch@gmail.com";
const EMAIL_PASSWORD = "yhhz nxel vcdd fdgg"; // NOT your normal password! Use an App Password

export async function sendEmail(input: SendEmailInput & { signature?: string }) {
  const message = sendEmailSchema.parse(input); // validate

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  });
  
  // NOTE: For HTML email, carriage returns (\n) will be ignored by email clients.
  // The content here should be the raw HTML string provided by the LLM.
  const htmlBodyWithSignature = input.signature 
    ? `${message.body}\n\n${input.signature}` 
    : message.body;

  await transporter.sendMail({
    from: EMAIL_ADDRESS,
    to: message.to,
    cc: "mars@mlops.nyc",
    subject: message.subject,
    html: htmlBodyWithSignature, 
  });

  console.log(`Email sent to ${message.to}`);
}


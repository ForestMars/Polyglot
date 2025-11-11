import nodemailer from "nodemailer";
import { sendEmailSchema, SendEmailInput } from "./schema";

// Replace these with your actual Gmail credentials
const EMAIL_ADDRESS = "your_email@gmail.com";
const EMAIL_PASSWORD = "your_app_password"; // NOT your normal password! Use an App Password

export async function sendEmail(input: SendEmailInput) {
  const message = sendEmailSchema.parse(input); // validate

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: EMAIL_ADDRESS,
    to: message.to,
    subject: message.subject,
    text: message.body,
  });

  console.log(`Email sent to ${message.to}`);
}


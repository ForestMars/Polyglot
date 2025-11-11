import { sendEmail } from "./gmail";
import { SendEmailInput } from "./schema";

async function main() {
  const email: SendEmailInput = {
    to: "recipient@example.com",
    subject: "Test Email from Local Client",
    body: "This is a test email sent via local SMTP, no Google Cloud needed.",
  };

  await sendEmail(email);
}

main().catch(console.error);


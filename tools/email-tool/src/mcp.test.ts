import { sendEmail } from "./gmail";
import { SendEmailInput } from "./schema";

async function main() {
  const email: SendEmailInput = {
    to: "themarsgroup@gmail.com",
    subject: "Test Email 2 from Local Client",
    body: "This is a test email sent via local SMTP, no Google Cloud needed.",
  };

  await sendEmail(email);
}

main().catch(console.error);


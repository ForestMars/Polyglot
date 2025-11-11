import { sendEmail } from "./gmail";
import { SendEmailInput } from "./schema";

async function main() {
  // Replace with your local LLM call if needed
  const email: SendEmailInput = {
    to: "recipient@example.com",
    subject: "Test Email from Local LLM",
    body: "This is a single test email sent using the local MCP tool.",
  };

  await sendEmail(email);
}

main().catch(console.error);


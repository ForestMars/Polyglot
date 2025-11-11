import { sendEmail } from "./gmail";
import { SendEmailInput } from "./schema";

async function testSendEmail() {
  const email: SendEmailInput = {
    to: "themarsgroup@gmail.com",       // replace with your test recipient
    subject: "SMTP Test Email",
    body: "This is a test email sent directly from gmail.ts",
  };

  try {
    await sendEmail(email);
    console.log("gmail.ts test succeeded!");
  } catch (err) {
    console.error("gmail.ts test failed:", err);
  }
}

testSendEmail();


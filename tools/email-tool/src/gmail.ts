import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { sendEmailSchema, SendEmailInput } from "./schema";

function loadAuth() {
  const authPath = path.resolve(".auth/credentials.json");
  if (!fs.existsSync(authPath)) throw new Error(`.auth file not found at ${authPath}`);
  return JSON.parse(fs.readFileSync(authPath, "utf-8"));
}

export async function sendEmail(input: SendEmailInput) {
  const message = sendEmailSchema.parse(input); // validate

  const creds = loadAuth();
  let auth;

  if (creds.type === "service_account") {
    auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      subject: creds.user, // the user to send email as
    });
  } else {
    const { client_id, client_secret, redirect_uris, refresh_token } =
      creds.installed || creds.web || {};
    if (!client_id || !client_secret || !refresh_token)
      throw new Error(".auth file missing client_id, client_secret, or refresh_token");

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials({ refresh_token });
    auth = oAuth2Client;
  }

  const gmail = google.gmail({ version: "v1", auth });

  const raw = Buffer.from(
    `To: ${message.to}\r\nSubject: ${message.subject}\r\n\r\n${message.body}`
  ).toString("base64url");

  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  console.log(`Email sent to ${message.to}`);
}


// email-tool/src/gmail.ts
import nodemailer from "nodemailer";
import { sendEmailSchema, SendEmailInput } from "./schema";
import { contactsService } from "./contacts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load credentials from .auth file
const authPath = join(__dirname, '..', '.auth');
const authContent = readFileSync(authPath, 'utf-8');

const authLines = authContent.split('\n');
const EMAIL_ADDRESS = authLines.find(line => line.startsWith('EMAIL_ADDRESS='))?.split('=')[1]?.trim() || '';
const EMAIL_PASSWORD = authLines.find(line => line.startsWith('EMAIL_PASSWORD='))?.split('=')[1]?.trim() || '';

if (!EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  throw new Error('Missing EMAIL_ADDRESS or EMAIL_PASSWORD in .auth file');
}

export async function sendEmail(input: SendEmailInput & { signature?: string }) {
  const message = sendEmailSchema.parse(input);
  
  // Resolve contacts - handle both string and array
  let recipients: string;
  if (Array.isArray(message.to)) {
    recipients = message.to.map(t => contactsService.resolve(t)).join(', ');
  } else {
    recipients = contactsService.resolve(message.to);
  }
  
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  });
  
  // Convert both literal \n and escaped \\n to <br> tags for HTML email
  const bodyWithBreaks = message.body
    .replace(/\\n/g, '\n')
    .replace(/\n/g, '<br>');
    
  const signatureWithBreaks = input.signature 
    ? input.signature.replace(/\n/g, '<br>')
    : '';
  
  const aiDisclosure = '<br><br><em>This is Compustretch, Forest\'s AI assistant.</em><br><br>';
  
  const htmlBodyWithSignature = input.signature 
    ? `${bodyWithBreaks}${aiDisclosure}${signatureWithBreaks}` 
    : `${bodyWithBreaks}${aiDisclosure}`;
    
  await transporter.sendMail({
    from: EMAIL_ADDRESS,
    to: recipients,
    cc: "mars@mlops.nyc",
    subject: message.subject,
    html: htmlBodyWithSignature, 
  });
  
  console.log(`Email sent to ${recipients}`);
}
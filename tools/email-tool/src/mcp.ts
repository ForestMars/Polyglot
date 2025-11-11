import { tool, startMCPServer } from "model-context-protocol";
import { sendEmail } from "./gmail";
import { SendEmailInput } from "./schema";

// Wrap sendEmail as a callable tool
export const sendEmailTool = tool<SendEmailInput>({
  name: "send_email",
  description: "Send an email via Gmail SMTP",
  run: async (input) => {
    await sendEmail(input);
    return { status: "ok" };
  },
});

// Start MCP server exposing the tool
startMCPServer({
  tools: [sendEmailTool],
  port: 3000, // any free port
});


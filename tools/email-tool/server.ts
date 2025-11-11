// email-server.mjs
import { WebSocket, WebSocketServer } from 'ws';
import { sendEmail } from './src/gmail.ts';

const wss = new WebSocketServer({ port: 9002 });

console.log('Email MCP Server running on ws://localhost:9002');

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
    
    if (msg.method === 'tools/list') {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: [{
            name: 'send_email',
            description: `Send an email via Gmail SMTP.

IMPORTANT WORKFLOW:
1. Before calling this tool, draft the email and show it to the user
2. Ask "Should I send this email? Reply 'yes' to confirm."
3. Only call send_email() after the user explicitly confirms with 'yes' or 'send'

Never send emails without user confirmation.`,
            inputSchema: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body' }
              },
              required: ['to', 'subject', 'body']
            }
          }]
        }
      }));
    }
    
    if (msg.method === 'tools/call' && msg.params.name === 'send_email') {
      try {
        await sendEmail(msg.params.arguments);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            content: [{ 
              type: 'text', 
              text: `Email sent to ${msg.params.arguments.to}` 
            }]
          }
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: -1,
            message: error.message
          }
        }));
      }
    }
  });
});
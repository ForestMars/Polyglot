// server.ts
import { WebSocket, WebSocketServer } from 'ws';
import { sendEmail } from './src/gmail.ts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load signature once at startup
const EMAIL_SIGNATURE = readFileSync(join(__dirname, 'config', 'sig.txt'), 'utf-8');

// Here's where the magic hapens, obvi.
const SEND_EMAIL_DESCRIPTION = readFileSync(join(__dirname, 'config', 'tool-descript.txt'), 'utf-8');

const wss = new WebSocketServer({ port: 9002 });

console.log('Email MCP Server running on ws://localhost:9002');
console.log('Loaded email signature:', EMAIL_SIGNATURE.substring(0, 50) + '...');

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
            description: SEND_EMAIL_DESCRIPTION,
            inputSchema: {
              type: 'object',
              properties: {
                to: { 
                  oneOf: [
                  { type: 'string', description: 'Single recipient email address' },
                  { type: 'array', items: { type: 'string' }, description: 'Multiple recipient email addresses' }
                ],
                description: 'Recipient email address' },
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
        await sendEmail({ ...msg.params.arguments, signature: EMAIL_SIGNATURE });
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
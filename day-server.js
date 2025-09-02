// day-server.mjs - The MCP server (run separately)
import { WebSocket, WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 9001 });

console.log('Day MCP Server running on ws://localhost:9001');

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.method === 'tools/list') {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: [{
            name: 'get_day',
            description: 'Returns current day of the week'
          }]
        }
      }));
    }
    
    if (msg.method === 'tools/call' && msg.params.name === 'get_day') {
      const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: `Today is ${day}` }]
        }
      }));
    }
  });
});
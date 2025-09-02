// get-users.js - Get the fucking users
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const envVars = {};
const envFile = readFileSync('.notion', 'utf8');
envFile.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [key, value] = line.split('=');
        envVars[key] = value;
    }
});

const mcpServer = spawn('npx', ['-y', '@notionhq/notion-mcp-server'], {
    env: { ...process.env, ...envVars },
    stdio: ['pipe', 'pipe', 'pipe']
});

mcpServer.stdout.on('data', (data) => {
    try {
        const response = JSON.parse(data.toString().trim());
        if (response.id === 1) {
            // Initialize done, get users
            mcpServer.stdin.write(JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    name: "API-get-users",
                    arguments: {}
                },
                id: 2
            }) + '\n');
        } else if (response.id === 2) {
            // Got users
            console.log('Users:', JSON.stringify(response.result.content, null, 2));
            mcpServer.kill();
        }
    } catch (e) {
        console.log('Raw:', data.toString());
    }
});

// Initialize
mcpServer.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "get-users", version: "1.0.0" }
    },
    id: 1
}) + '\n');

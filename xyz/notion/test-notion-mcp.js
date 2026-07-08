// get-mcp-users.js - Just get the fucking users from MCP
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

// Load environment
const envVars = {};
const envFile = readFileSync('.notion', 'utf8');
envFile.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [key, value] = line.split('=');
        envVars[key] = value;
    }
});

console.log('=== Getting Users from MCP Server ===');

// Start the MCP server process
const mcpServer = spawn('npx', ['-y', '@notionhq/notion-mcp-server'], {
    env: { ...process.env, ...envVars },
    stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';
let initialized = false;

// Handle server responses
mcpServer.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || '';
    
    lines.forEach(line => {
        if (line.trim()) {
            try {
                const response = JSON.parse(line);
                
                if (response.id === 1 && !response.error) {
                    // Initialize successful, get users
                    console.log('Initialized. Getting users...');
                    initialized = true;
                    sendRequest('tools/call', {
                        name: 'list_users',
                        arguments: {}
                    });
                } else if (response.id === 2) {
                    // Users response
                    if (response.error) {
                        console.log('Error getting users:', response.error);
                        // Try different method
                        sendRequest('resources/read', {
                            uri: 'notion://users'
                        });
                    } else {
                        console.log('Users:', JSON.stringify(response.result, null, 2));
                        mcpServer.kill();
                        process.exit(0);
                    }
                } else if (response.id === 3) {
                    console.log('Users via resources:', JSON.stringify(response.result, null, 2));
                    mcpServer.kill();
                    process.exit(0);
                }
            } catch (e) {
                // Ignore non-JSON lines
            }
        }
    });
});

function sendRequest(method, params) {
    const request = {
        jsonrpc: "2.0",
        method: method,
        params: params || {},
        id: initialized ? 2 : 1
    };
    
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
}

// Initialize first
sendRequest('initialize', {
    protocolVersion: "2024-11-05",
    capabilities: {
        roots: { listChanged: true },
        sampling: {}
    },
    clientInfo: {
        name: "user-getter",
        version: "1.0.0"
    }
});

// Cleanup
process.on('SIGINT', () => {
    mcpServer.kill();
    process.exit();
});

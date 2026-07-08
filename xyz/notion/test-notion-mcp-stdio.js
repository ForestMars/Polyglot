// stdio-test.js - Test MCP server via stdio (the way it actually works)
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

console.log('=== Testing MCP Server via STDIO ===');

// Start the MCP server process
const mcpServer = spawn('npx', ['-y', '@notionhq/notion-mcp-server'], {
    env: { ...process.env, ...envVars },
    stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';
let requestId = 1;

// Handle server responses
mcpServer.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    
    // Process complete JSON-RPC messages
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || ''; // Keep incomplete line
    
    lines.forEach(line => {
        if (line.trim()) {
            try {
                const response = JSON.parse(line);
                console.log('Response:', JSON.stringify(response, null, 2));
                
                // Send next request based on response
                if (response.id === 1 && !response.error) {
                    // Initialize successful, list resources
                    sendRequest('resources/list', {});
                } else if (response.id === 2 && !response.error) {
                    // Resources listed, list tools
                    sendRequest('tools/list', {});
                } else if (response.id === 3) {
                    // All done
                    mcpServer.kill();
                    process.exit(0);
                }
            } catch (e) {
                console.log('Raw output:', line);
            }
        }
    });
});

function sendRequest(method, params) {
    const request = {
        jsonrpc: "2.0",
        method: method,
        params: params || {},
        id: ++requestId
    };
    
    console.log(`\nSending ${method}:`, JSON.stringify(request, null, 2));
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
}

// Start with initialize
console.log('\n1. Initializing...');
sendRequest('initialize', {
    protocolVersion: "2024-11-05",
    capabilities: {
        roots: { listChanged: true },
        sampling: {}
    },
    clientInfo: {
        name: "test-client",
        version: "1.0.0"
    }
});

// Cleanup on exit
process.on('SIGINT', () => {
    mcpServer.kill();
    process.exit();
});

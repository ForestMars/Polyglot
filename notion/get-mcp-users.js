// get-mcp-users.js - Find available tools first, then get users
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
let requestId = 0;

// Handle server responses
mcpServer.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || '';
    
    lines.forEach(line => {
        if (line.trim()) {
            try {
                const response = JSON.parse(line);
                console.log(`Response ${response.id}:`, JSON.stringify(response, null, 2));
                
                if (response.id === 1 && !response.error) {
                    // Initialize successful, list tools
                    sendRequest('tools/list', {});
                } else if (response.id === 2 && !response.error) {
                    // Tools listed, look for user-related tools
                    const tools = response.result.tools || [];
                    console.log('\nAvailable tools:');
                    tools.forEach(tool => console.log(`- ${tool.name}: ${tool.description}`));
                    
                    // Try to find and call a user-related tool
                    const userTool = tools.find(t => 
                        t.name.toLowerCase().includes('user') || 
                        t.name.toLowerCase().includes('people') ||
                        t.name.toLowerCase().includes('member')
                    );
                    
                    if (userTool) {
                        console.log(`\nCalling ${userTool.name}...`);
                        sendRequest('tools/call', {
                            name: userTool.name,
                            arguments: {}
                        });
                    } else {
                        console.log('\nNo user-related tools found. Listing resources...');
                        sendRequest('resources/list', {});
                    }
                } else if (response.id === 3) {
                    if (response.error) {
                        console.log('Tool call failed, trying resources...');
                        sendRequest('resources/list', {});
                    } else {
                        console.log('\nUsers from tool:', response.result);
                        mcpServer.kill();
                        process.exit(0);
                    }
                } else if (response.id === 4) {
                    console.log('\nResources:', response.result);
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
    requestId++;
    const request = {
        jsonrpc: "2.0",
        method: method,
        params: params || {},
        id: requestId
    };
    
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
}

// Initialize
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

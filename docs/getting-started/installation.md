# Installation

Get your AI research playground up and running with persistent memory, model switching, and knowledge integration capabilities.

## Quick Start for Researchers

### Option 1: Use Hosted Research Environment (Recommended)

The fastest way to start AI research with Polyglot:

1. **Visit Research Environment**
   - Go to `https://research.polyglot-ai.org` (or your institution's deployment)
   - No installation required - runs entirely in your browser
   - All research data stored locally with optional sync

2. **Initial Setup**
   - Configure AI provider API keys (OpenAI, Anthropic, Google)
   - Enable "Research Mode" for persistent memory features
   - Upload your first research documents to test RAG integration
   - Start your first research conversation and observe memory persistence

### Option 2: Local Development for Advanced Research

For researchers who need custom configurations or institutional compliance:

```bash
# Clone the research environment
git clone https://github.com/ForestMars/Polyglot.git
cd Polyglot

# Install dependencies
npm install

# Start research environment
npm run dev:research

# Access at http://localhost:3000
```

## System Requirements

### Minimum Requirements for Basic Research

- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+
- **RAM**: 4GB system memory
- **Storage**: 500MB available browser storage
- **Network**: Internet connection for cloud AI models (optional for local models)

### Recommended for Serious Research

- **Browser**: Latest Chrome or Firefox with 8GB+ allocated memory
- **RAM**: 16GB system memory for large knowledge bases
- **Storage**: 10GB+ available storage for extensive research projects
- **GPU**: 8GB+ VRAM for local AI models via Ollama (optional)
- **Network**: Stable broadband for real-time collaboration

### For Research Teams

- **Server**: 4+ CPU cores, 16GB RAM for sync server (optional)
- **Storage**: 100GB+ for collaborative research data
- **Network**: Reliable internet for team synchronization
- **Security**: HTTPS-enabled domain for secure collaboration

## Installation Methods

### Browser-Based Research Environment

**Immediate Research Access:**
1. Navigate to your Polyglot research environment URL
2. Enable JavaScript and allow local storage access
3. Configure API keys for your preferred AI providers
4. Begin research conversations with automatic memory persistence

**Browser Optimization for Research:**
```javascript
// Chrome flags for research optimization
chrome://flags/#enable-experimental-web-platform-features
chrome://flags/#enable-web-app-manifest

// Increase storage quota for large research projects
chrome://settings/content/all → [your-polyglot-domain] → Storage: Unlimited
```

### Local Development Installation

**For Research Customization and Institutional Deployment:**

1. **Prerequisites**
   ```bash
   # Node.js 18+ required
   node --version  # Should be 18.0.0 or higher
   npm --version   # Should be 9.0.0 or higher
   ```

2. **Clone and Setup**
   ```bash
   # Clone research environment
   git clone https://github.com/ForestMars/Polyglot.git
   cd Polyglot

   # Install research dependencies
   npm install

   # Copy research configuration
   cp .env.research.example .env.local
   ```

3. **Research Environment Configuration**
   ```bash
   # .env.local - Research-specific settings
   VITE_RESEARCH_MODE=true
   VITE_MEMORY_PERSISTENCE=permanent
   VITE_KNOWLEDGE_BASE_SIZE=10GB
   VITE_COLLABORATIVE_FEATURES=true

   # AI Provider Settings (optional - can be set in UI)
   VITE_OPENAI_API_KEY=your-openai-key
   VITE_ANTHROPIC_API_KEY=your-anthropic-key
   VITE_GOOGLE_AI_API_KEY=your-google-key
   ```

4. **Start Research Environment**
   ```bash
   # Development mode with hot reloading
   npm run dev:research

   # Production build for deployment
   npm run build:research
   npm run preview
   ```

### Docker Installation for Research Teams

**Containerized Research Environment:**

1. **Basic Research Container**
   ```bash
   # Pull research-optimized container
   docker pull polyglot/research:latest

   # Run individual research environment
   docker run -d \
     --name polyglot-research \
     -p 3000:3000 \
     -v polyglot_research_data:/data \
     -e RESEARCH_MODE=individual \
     polyglot/research:latest
   ```

2. **Team Research Environment**
   ```bash
   # Clone repository for team configuration
   git clone https://github.com/ForestMars/Polyglot.git
   cd Polyglot

   # Deploy team research stack
   docker-compose -f docker-compose.research-team.yml up -d
   ```

3. **Access Research Environment**
   - Individual: `http://localhost:3000`
   - Team sync server: `http://localhost:4001`

## AI Provider Setup

### Cloud AI Models

**OpenAI Configuration:**
1. Obtain API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In Polyglot: Settings → AI Providers → OpenAI
3. Add API key and select models: GPT-4o, GPT-4, GPT-3.5-turbo
4. Test with a research conversation to verify functionality

**Anthropic (Claude) Setup:**
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Navigate to Settings → AI Providers → Anthropic
3. Configure Claude models: Sonnet 4, Opus 4, Haiku 3.5
4. Test model switching with preserved research context

**Google AI (Gemini) Configuration:**
1. Obtain API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Go to Settings → AI Providers → Google
3. Enable Gemini Pro and Gemini Pro Vision
4. Test multi-modal research capabilities

### Local AI Models (Recommended for Private Research)

**Ollama Installation for Complete Privacy:**

1. **Install Ollama**
   ```bash
   # Linux/macOS
   curl -fsSL https://ollama.ai/install.sh | sh

   # Windows (PowerShell)
   winget install Ollama.Ollama
   ```

2. **Download Research Models**
   ```bash
   # General research models
   ollama pull llama3.2        # Meta's latest model
   ollama pull mistral         # Excellent for analysis
   ollama pull codellama       # Code-focused research

   # Specialized research models (if available)
   ollama pull research-llama  # Domain-specific models
   ollama pull academic-mistral
   ```

3. **Configure in Polyglot**
   - Settings → AI Providers → Ollama (Local)
   - Verify connection to `http://localhost:11434`
   - Select downloaded models for research
   - Test offline research capability

**GPU Acceleration Setup:**
```bash
# NVIDIA GPU support
# Ensure NVIDIA drivers and CUDA are installed
nvidia-smi  # Verify GPU availability

# Ollama automatically uses GPU if available
# Monitor GPU usage during AI conversations
watch nvidia-smi
```

## Research Environment Verification

### Verify Core Research Features

**Memory Persistence Test:**
1. Start a research conversation
2. Add some context and insights
3. Close browser completely
4. Reopen and verify conversation persists with full context
5. Switch AI models mid-conversation and verify context transfer

**Knowledge Base Integration Test:**
1. Upload a research document (PDF or DOCX)
2. Wait for processing completion
3. Ask questions that should reference the document
4. Verify citations appear in AI responses
5. Test semantic search across uploaded documents

**Research Project Organization Test:**
1. Create a new research project
2. Start multiple conversations within the project
3. Verify cross-conversation memory linking
4. Test project-level analytics and insights
5. Export project data to verify completeness

### Performance Verification

**Research Workflow Performance:**
```bash
# Browser performance testing
# Open browser dev tools → Performance tab
# Record a typical research session:
# - Start conversation
# - Switch models
# - Upload document
# - Search knowledge base
# - Export research data

# Verify performance targets:
# - Model switching: < 2 seconds
# - Document upload: < 30 seconds for 10MB
# - Knowledge search: < 500ms
# - Memory retrieval: < 100ms
```

**Storage and Memory Usage:**
```javascript
// Check browser storage usage
navigator.storage.estimate().then(estimate => {
  console.log('Storage used:', estimate.usage);
  console.log('Storage quota:', estimate.quota);
  console.log('Usage percentage:', (estimate.usage / estimate.quota * 100).toFixed(2) + '%');
});

// Monitor memory usage during research
// Chrome DevTools → Memory tab → Take heap snapshots
// Verify no memory leaks during extended research sessions
```

## Troubleshooting Installation

### Common Installation Issues

**Browser Compatibility Issues:**
```bash
# Verify browser support
# Check: chrome://version/ or about:firefox
# Minimum versions:
# - Chrome 90+ (recommended: latest)
# - Firefox 88+ (recommended: latest)
# - Safari 14+ (recommended: latest)
# - Edge 90+ (recommended: latest)
```

**Storage Quota Issues:**
```javascript
// Request persistent storage for research
navigator.storage.persist().then(granted => {
  console.log('Persistent storage granted:', granted);
});

// Check available storage
navigator.storage.estimate().then(estimate => {
  if (estimate.quota < 1e9) { // Less than 1GB
    console.warn('Limited storage available for research data');
    // Consider using external storage or sync server
  }
});
```

**Local AI Model Issues:**
```bash
# Verify Ollama installation
ollama --version

# Check Ollama service status
# Linux/macOS:
systemctl status ollama
# or
ps aux | grep ollama

# Windows:
Get-Process ollama

# Test Ollama API
curl http://localhost:11434/api/tags

# Check model downloads
ollama list
```

**Network and API Issues:**
```bash
# Test API connectivity
curl -X POST "https://api.openai.com/v1/models" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl -X POST "https://api.anthropic.com/v1/messages" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json"

# Verify CORS settings for local development
# Check browser console for CORS errors
# Configure proxy settings if needed
```

### Research-Specific Troubleshooting

**Memory Context Issues:**
1. Verify "Research Mode" is enabled in settings
2. Check that "Memory Persistence" is set to "Permanent"
3. Clear browser cache and reload (will reset research data)
4. Test with incognito/private window to isolate extension conflicts

**Knowledge Base Processing Issues:**
1. Verify document format is supported (PDF, DOCX, MD, TXT)
2. Check document size (limit: 100MB per document)
3. Monitor browser console for processing errors
4. Test with smaller documents first
5. Verify sufficient storage space available

**Model Switching Issues:**
1. Ensure all API keys are configured correctly
2. Verify network connectivity to AI providers
3. Check API usage limits and quotas
4. Test model switching with simple conversations first
5. Monitor browser console for API errors

## Next Steps

### Configure Your Research Environment

After successful installation:

1. **[Configuration Guide](configuration.md)**: Optimize Polyglot for your research needs
2. **[Quick Start Guide](quick-start.md)**: Begin your first research conversation
3. **[Features Overview](../user-guide/features.md)**: Explore all research capabilities

### Advanced Setup

For research teams and institutions:

1. **Team Collaboration**: Set up sync server for collaborative research
2. **Institutional Integration**: Configure SSO and compliance features
3. **Custom Deployment**: Deploy on institutional infrastructure
4. **API Integration**: Connect with institutional research systems

### Research Community

Join the research community:

1. **Documentation**: Comprehensive guides for research workflows
2. **Community Forum**: Connect with other researchers using Polyglot
3. **Best Practices**: Shared methodologies and research approaches
4. **Contribute**: Help improve Polyglot for the research community

Your AI research playground is now ready - begin building persistent research memory and conducting rigorous AI model comparisons with complete privacy and data control.

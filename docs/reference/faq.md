# Frequently Asked Questions

Common questions about using Polyglot as an AI research playground with persistent memory and knowledge integration.

## General Research Questions

### What makes Polyglot different from ChatGPT or Claude?

Polyglot is designed as a **research environment**, not just a chat interface. The key differences:

- **Persistent Memory**: Your conversations and insights persist indefinitely across sessions and model switches
- **Model Comparison**: Switch between GPT, Claude, Gemini, and local models while maintaining context
- **Research Memory**: Key insights are extracted and preserved as searchable memory markers
- **Knowledge Integration**: Upload your documents (RAG) and connect tools (MCP) to enhance AI capabilities
- **Privacy Control**: Everything runs locally with optional sync, so you own your research data

Think of it as the difference between using a notepad (traditional AI chat) versus a research lab with persistent equipment, notes, and accumulated knowledge (Polyglot).

### Can I use Polyglot for serious academic research?

Yes, Polyglot is specifically designed for rigorous research workflows:

- **Reproducible Research**: Complete audit trails and exportable research data
- **Controlled Comparisons**: Run identical experiments across different AI models
- **Citation Tracking**: Full provenance of information sources and AI responses
- **Long-term Projects**: Support for research spanning months or years
- **Collaboration**: Team research while preserving individual privacy
- **Data Integrity**: Research memory preserved with cryptographic verification

Many researchers use Polyglot for literature reviews, hypothesis development, model evaluation, and collaborative research projects.

### How much does Polyglot cost?

Polyglot itself is free and open-source. You only pay for the AI services you choose to use:

- **Local Models (Ollama)**: Completely free, runs on your hardware
- **OpenAI API**: Pay OpenAI's API rates for GPT models
- **Anthropic API**: Pay Anthropic's rates for Claude models
- **Google AI**: Pay Google's rates for Gemini models
- **Optional Sync Server**: Free for personal use, hosting costs for team deployments

The memory management, knowledge integration, and research features are all free.

## Memory and Context Questions

### How does persistent memory work across AI models?

When you switch models (e.g., from GPT-4 to Claude), Polyglot:

1. **Captures Context**: Takes a complete snapshot of conversation history and memory markers
2. **Adapts Format**: Translates context to work optimally with the target AI model
3. **Preserves Memory**: Ensures all research insights and memory markers transfer intact
4. **Maintains Continuity**: You continue the conversation as if no switch occurred

This enables controlled comparative studies where you can run the same prompt across multiple models with identical context.

### What are memory markers and why are they important?

Memory markers are extracted insights, decisions, and findings that persist beyond individual conversations:

- **Research Findings**: Key discoveries or conclusions from AI analysis
- **Methodological Decisions**: Choices about research approach or process
- **Hypotheses**: Research hypotheses that evolve over time
- **Evidence**: Supporting or contradicting evidence for research claims
- **Questions**: Important questions to explore in future research

Memory markers transform AI interactions from disposable chats into cumulative research intelligence that builds over time.

### How much conversation history can I store?

Storage is limited only by your browser's capacity (typically 1GB+ available):

- **Individual Conversations**: No practical limit on conversation length
- **Total Conversations**: Store thousands of research conversations
- **Memory Markers**: Unlimited memory markers with full search capability
- **Knowledge Base**: Supports gigabytes of research documents
- **Performance**: System remains fast even with large research databases

For team environments, server storage can scale to organizational research needs.

### Can I export my research data?

Yes, Polyglot provides comprehensive export capabilities:

- **Complete Research Export**: All conversations, memory markers, and knowledge base
- **Selective Export**: Choose specific projects, conversations, or time ranges
- **Multiple Formats**: JSON, CSV, Markdown, and formatted research reports
- **Citation-Ready**: Exports include complete provenance and citation information
- **Reproducible**: Exported data includes all information needed to reproduce research

## Model Integration Questions

### Which AI models does Polyglot support?

**Cloud Models:**
- **OpenAI**: GPT-4o, GPT-4, GPT-3.5-turbo, and future models
- **Anthropic**: Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku
- **Google**: Gemini Pro, Gemini Pro Vision
- **Future Models**: Architecture designed to integrate new AI providers easily

**Local Models via Ollama:**
- **Meta**: Llama 3.2, Llama 2
- **Mistral**: Mistral 7B, Mixtral 8x7B
- **Code Models**: CodeLlama, Code Gemma
- **Specialized**: Research-domain fine-tuned models
- **Custom Models**: Any model supported by Ollama

### Can I run Polyglot completely offline?

Yes, with local models via Ollama:

- **Full Functionality**: Complete research environment works offline
- **Local AI Models**: Run Llama, Mistral, and other models on your hardware
- **Memory Management**: All memory features work offline
- **Knowledge Integration**: RAG and local tool integration available offline
- **No Cloud Dependency**: Research continues without internet connectivity

This is particularly valuable for sensitive research or unreliable internet environments.

### How do I compare responses across different AI models?

Polyglot makes model comparison straightforward:

1. **Start Conversation**: Begin research conversation with one model
2. **Build Context**: Develop conversation history and memory markers
3. **Switch Model**: Change to different AI model (context transfers automatically)
4. **Run Comparison**: Ask same question or provide same prompt
5. **Analyze Results**: Compare responses with identical context and memory

The system tracks performance metrics and enables statistical analysis of model differences.

## Knowledge Integration Questions

### What is RAG and how does it help my research?

RAG (Retrieval-Augmented Generation) integrates your research documents into AI conversations:

- **Document Upload**: Add PDFs, papers, notes, and research materials
- **Semantic Search**: AI automatically finds relevant information from your documents
- **Grounded Responses**: AI answers backed by your specific research materials
- **Citation Tracking**: Know exactly which documents inform each AI response
- **Knowledge Evolution**: Understanding improves as you add more research materials

Instead of generic AI responses, you get answers grounded in your specific research domain and materials.

### What types of documents can I upload?

Supported formats include:

- **PDFs**: Research papers, reports, documentation
- **Text Files**: Notes, transcripts, plain text research materials
- **Markdown**: Formatted research notes and documentation
- **Word Documents**: Research drafts and collaborative documents
- **Future Formats**: Architecture supports adding new document types

Documents are processed to preserve research context and enable semantic search across your entire knowledge base.

### What is MCP and what tools can I connect?

MCP (Model Context Protocol) connects external tools and data sources to enhance AI capabilities:

**Research Tools:**
- **File System Access**: AI can read/write research files
- **Database Connections**: Query research databases and datasets
- **Statistical Tools**: R, Python, statistical analysis capabilities
- **Literature Search**: Academic database queries and citation management
- **Collaboration Tools**: Integration with research team systems

**Custom Tools:**
- **APIs**: Connect to research-specific APIs and data sources
- **Scripts**: Execute custom research scripts and analysis tools
- **External Services**: Integration with institutional research infrastructure

### How does knowledge search work?

Polyglot uses advanced semantic search across your knowledge base:

- **Semantic Understanding**: Searches by meaning, not just keywords
- **Context-Aware**: Search results ranked by relevance to current conversation
- **Cross-Reference**: Finds connections between documents and conversations
- **Research Memory**: Integrates with memory markers for comprehensive search
- **Performance**: Sub-second search across gigabytes of research materials

## Privacy and Security Questions

### Is my research data private?

Yes, Polyglot is designed with privacy as a core principle:

- **Local-First**: All research data stored in your browser by default
- **No Server Required**: Complete functionality without sending data anywhere
- **Optional Sync**: Cloud sync is opt-in with encryption and privacy controls
- **User-Controlled Keys**: You control encryption keys for any synced data
- **

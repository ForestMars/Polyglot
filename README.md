
# Polyglot Local Research Playground 

A local AI playground for both personal use and research, where you control memory and context across models and conversations. Polyglot works equally well as a personal AI companion that remembers your interests and projects, or as a rigorous research environment for comparative AI studies. Build persistent knowledge that carries across model switches, chat threads, and sessions. Add your own documents via RAG, connect tools through MCP servers, and compare how different AI models (Cloud-based and local models) perform with the same controlled memory context. Everything runs locally with optional sync, so your research environment and accumulated knowledge stays private and under your control.

Full documentation at https://polyglot.gitbook.io/polyglot/

## Memory as the Foundation of Intelligence

Traditional LLM interfaces treat each conversation as isolated and ephemeral. Polyglot recognizes that 'true' intelligence (both artificial and human) depends on continuity of memory, the ability to build upon previous understanding, and the freedom to explore ideas across different perspectives without losing context. By making memory persistent and transferable across different AI models, sessions and threads, Polyglot enables new forms of investigation: controlled comparative studies, longitudinal research projects, and cumulative knowledge systems that grow more valuable over time. This same persistent memory architecture also supports personalized applications, including AI assistants that function as digital twins or "second brains" under individual control. Whether applied to research contexts or personal use, these memory-enabled systems can maintain continuity across different AI models and platforms, accumulating context-specific knowledge and evolving their understanding over extended extended interactions in a highly controllable way. 

### Key capabilities:

- Memory control: Decide what persists across all conversations and models
- Model comparison: Switch between GPT, Claude, Gemini, and local models with consistent context
- Knowledge integration: Add your documents (RAG) and external tools (MCP)
- Research continuity: Long-term projects that build context over time
- Local-first: Your playground, your data, your control

## AI Chat Interface
![Polyglot UI](/assets/polyglot-screencap.png)

[![React](https://img.shields.io/badge/React-18.3.1-blue?style=flat&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.1-purple?style=flat&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.11-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

A modern, elegant AI chat interface built with React, TypeScript, and Tailwind CSS. Connect to multiple AI providers (OpenAI, Anthropic, Google) with a beautiful glass-morphism design.

## Features

- **Multi-Provider Support**: Connect to OpenAI, Anthropic, Google AI services, and Ollama (local)
- **Conversation Persistence**: Complete conversation management with automatic saving, history and cross-browser/device sync
- **Beautiful UI**: Glass-morphism design with smooth animations and modern aesthetics
- **API Key Management**: Securely store and manage multiple API keys per provider
- **Local AI Support**: Run AI models locally with Ollama (no API keys required)
- **Model Selection**: Choose from various AI models for each provider
- **Model Switching**: Switch AI models mid-conversation with full context preservation
- **Real-time Chat**: Smooth message flow with typing indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark Mode**: Elegant dark theme optimized for extended use
- **Toast Notifications**: User-friendly feedback for actions and errors
- **Automatic Persistence**: Every conversation is saved locally and synced server-side  
- **Cross-Browser & Cross-Device**: Open PolyGlot anywhere and see your full history  
- **Offline-First**: Works seamlessly without network; syncs when reconnected  
- **Smart Migration**: Runs on each app start to guarantee consistency  
- **Archive System**: Archive old conversations to keep your sidebar organized
- **Real-time Sync**: Updates propagate instantly across tabs and devices  
- **Model Switching**: Switch AI models mid-conversation with full context preservation
- **Smart Search**: Find conversations by title, content, or model used
- **Testing**: Comprehensive test suite with Vitest and React Testing Library

### Use Cases

- **Research & Learning**: Keep AI-assisted research synced across all devices  
- **Code Development**: Maintain context while iterating on coding problems across desktop / laptop
- **Content Creation**: Build upon previous AI conversations for long-term projects
- **Model Comparison**: Easily compare responses from different AI models
- **Knowledge Management**: Organize and retrieve AI-generated insights
- **Team Environments**: Ensure consistency when testing or demoing across machines  

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build for development
npm run preview      # Preview production build

# Testing
npm run test         # Run tests in watch mode
npm run test:ui      # Run tests with UI
npm run test:run     # Run tests once
npm run coverage     # Generate coverage report

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Tech Stack

- **Frontend**: React 18.3.1, TypeScript 5.5.3
- **Build Tool**: Vite 5.4.1
- **Styling**: Tailwind CSS 3.4.11
- **UI Components**: Shadcn/ui with Radix UI
- **State Management**: Custom centralized state management with observer pattern
- **Data Persistence**: Web Storage (localStorage) with automatic validation
- **Icons**: Lucide React
- **Animations**: CSS animations with Tailwind
- **Testing**: Vitest, React Testing Library, MSW

Full documentation at https://polyglot.gitbook.io/polyglot/

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Radix UI](https://www.radix-ui.com/) for accessible primitives
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first styling
- [Lucide](https://lucide.dev/) for the beautiful icons
- [Vitest](https://vitest.dev/) for the fast testing framework


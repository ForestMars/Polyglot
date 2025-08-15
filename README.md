# PolyGlut - AI Chat Interface

A modern, elegant AI chat interface built with React, TypeScript, and Tailwind CSS. Connect to multiple AI providers (OpenAI, Anthropic, Google) with a beautiful glass-morphism design.

[![React](https://img.shields.io/badge/React-18.3.1-blue?style=flat&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.1-purple?style=flat&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.11-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

## Features

- **Multi-Provider Support**: Connect to OpenAI, Anthropic, and Google AI services
- **Beautiful UI**: Glass-morphism design with smooth animations and modern aesthetics
- **API Key Management**: Securely store and manage multiple API keys per provider
- **Model Selection**: Choose from various AI models for each provider
- **Real-time Chat**: Smooth message flow with typing indicators
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark Mode**: Elegant dark theme optimized for extended use
- **Toast Notifications**: User-friendly feedback for actions and errors
- **Testing**: Comprehensive test suite with Vitest and React Testing Library

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn (bun support coming soon)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/polyglut.git
   cd polyglut
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional for development)
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys if testing real integrations
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## Configuration

### Setting Up AI Providers

1. **Open Settings**: Click the settings icon (⚙️) in the top-right corner
2. **Select Provider**: Choose from OpenAI, Anthropic, or Google
3. **Add API Key**: Click "Add Key" and enter your API credentials
4. **Choose Model**: Select the AI model you want to use
5. **Start Chatting**: Begin your conversation!

### Supported Providers & Models

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-4.1, GPT-4o, GPT-4o-mini |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku |
| **Google** | Gemini Pro, Gemini Pro Vision |

## Development

### Project Structure

```
src/
├── components/
│   ├── ChatInterface.tsx    # Main chat component
│   ├── SettingsPanel.tsx    # Settings management
│   └── ui/                  # Shadcn/ui components
├── pages/
│   ├── Index.tsx           # Main page
│   └── NotFound.tsx        # 404 page
├── hooks/
│   ├── use-mobile.tsx      # Mobile detection hook
│   └── use-toast.ts        # Toast notifications
├── lib/
│   └── utils.ts            # Utility functions
├── __tests__/              # Test files
│   ├── hooks/              # Hook tests
│   └── utils/              # Utility tests
└── App.tsx                 # Root component
```

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
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Animations**: CSS animations with Tailwind
- **Testing**: Vitest, React Testing Library, MSW

## Testing

The project includes a comprehensive test suite:

- **Unit Tests**: Component and hook testing with React Testing Library
- **Mock Service Worker**: API mocking for consistent test results
- **Test Utilities**: Custom render functions and test helpers
- **Coverage**: Code coverage reporting with Vitest

Run tests with:
```bash
npm run test        # Watch mode
npm run test:run    # Single run
npm run coverage    # Coverage report
```

## Design System

### Color Palette
- **Primary**: Purple gradient (`hsl(263 70% 50%)`)
- **Background**: Dark gradient with glass effect
- **Chat Bubbles**: User messages in purple, AI responses in muted gray
- **Glass Effect**: Backdrop blur with semi-transparent backgrounds

### Key Design Features
- **Glass-morphism**: Semi-transparent panels with backdrop blur
- **Smooth Animations**: Message slide-in and typing indicators
- **Responsive Layout**: Adapts to different screen sizes
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Security

- API keys are stored locally in browser memory (not persisted)
- No server-side storage of sensitive data
- Secure input handling and validation
- Masked API key display in settings

## Current Status

**Note**: This is currently a frontend-only implementation with simulated API responses. To connect to real AI services, you'll need to:

1. Implement actual API calls in `ChatInterface.tsx`
2. Add proper error handling for API failures
3. Consider rate limiting and usage tracking
4. Add message persistence if needed

## Deployment

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service like:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

### Environment Variables

For production deployment, you may need to set environment variables:
- `VITE_APP_TITLE`: Application title
- `VITE_APP_DESCRIPTION`: Application description

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and TypeScript patterns
- Add tests for new features
- Ensure all tests pass before submitting PRs
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Radix UI](https://www.radix-ui.com/) for accessible primitives
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first styling
- [Lucide](https://lucide.dev/) for the beautiful icons
- [Vitest](https://vitest.dev/) for the fast testing framework


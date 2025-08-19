# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-08-18

### Added 
- **Conversation Management UI**: Complete conversation sidebar with intuitive navigation
  - ConversationSidebar component with search, filtering, and archiving
  - Real-time conversation list with smart date formatting
  - Provider-specific icons and model badges
  - Right-click context menus for conversation actions
- **Enhanced ChatInterface Integration**: Seamless conversation management
  - Auto-conversation creation on first message
  - Conversation switching with full context preservation
  - Real-time conversation title display in header
  - Collapsible sidebar with responsive design
- **Model Switching Mid-Conversation**: Complete implementation with tracking
  - Click-to-switch model badges in chat header
  - Model change recording with timestamps
  - Seamless context preservation across model changes
  - Visual feedback for model switches
- **Auto-Save Functionality**: Background conversation persistence
  - Automatic saving after each message
  - Non-blocking background operations
  - Error handling with user feedback

### Changed
- **ChatInterface Layout**: Added sidebar integration with toggle functionality
- **Message Handling**: Enhanced to work with conversation persistence
- **Provider Validation**: Improved logic for local vs. cloud providers
- **State Management**: Centralized conversation and model state

### Technical Improvements
- **Storage Integration**: Full CRUD operations for conversation management
- **Error Handling**: Comprehensive error boundaries and user notifications
- **Performance**: Optimized re-renders and efficient state updates
- **Responsive Design**: Mobile-friendly sidebar with collapsible layout

## [0.2.1] - 2025-08-18

### Added
- **Ollama Integration**: Complete local AI model support with Ollama service
  - OllamaService class with chat, generate, and listModels methods
  - Health check functionality for Ollama connection status
  - Support for custom Ollama endpoints beyond localhost
  - Real-time connection monitoring in OllamaStatus component
- **Multi-Provider Architecture**: Unified API service supporting multiple AI providers
  - OpenAI, Anthropic, Google AI, and Ollama support
  - Provider-agnostic chat interface
  - Smart health checking for different provider types
- **Enhanced UI Components**: Modern, accessible interface components
  - Glass-morphism design with smooth animations
  - Responsive layout for desktop and mobile
  - Toast notifications for user feedback
  - Settings panel for provider and model configuration
- **Model Switching Support**: Dynamic model selection and switching
  - Real-time model availability display in chat header
  - Clickable model badges for quick selection
  - Support for switching models mid-conversation
  - Visual indicators for current model and available options
- **Comprehensive Testing**: Full test suite with modern testing tools
  - Vitest configuration with React Testing Library
  - Mock service worker for API testing
  - Hook testing utilities and custom render functions
  - Test coverage reporting
### Added in 0.0.1
- **Storage Service Layer**
    - Added src/services/storage.ts
    - File-based persistence for conversations and settings
    - CRUD operations for handling conversations
    - Auto-save functionality


### Changed
- **Project Structure**: Reorganized codebase for better maintainability
  - Separated services, components, and utilities
  - Implemented proper TypeScript interfaces
  - Added comprehensive error handling
- **Ollama Configuration**: Enhanced Ollama setup and management
  - Dynamic model loading from actual Ollama instance
  - Real-time status monitoring and health checks
  - Improved error handling and user feedback
- **User Experience**: Streamlined interface for better usability
  - Immediate model visibility in chat header
  - Quick model selection without navigating settings
  - Better validation logic for local vs. cloud providers

### Fixed
- **Ollama Integration Issues**: Resolved connection and model display problems
  - Fixed model dropdown showing incorrect models
  - Corrected validation logic for local providers
  - Resolved "Configure settings first" message when Ollama is ready
- **Model Selection**: Improved model switching and validation
  - Fixed hardcoded model list vs. actual available models
  - Corrected provider validation for local services
  - Enhanced model availability display

### Technical Improvements
- **Type Safety**: Enhanced TypeScript implementation
  - Proper interfaces for all API responses
  - Type-safe provider management
  - Comprehensive error handling with typed errors
- **Performance**: Optimized rendering and data fetching
  - Efficient model loading and caching
  - Optimized re-renders with proper state management
  - Background health checking without blocking UI
- **Code Quality**: Improved maintainability and readability
  - Consistent code style and patterns
  - Proper separation of concerns
  - Comprehensive error boundaries and fallbacks

## [0.1.0] - Initial Release

### Added
- **Base Application**: React + TypeScript + Vite foundation
- **UI Framework**: Shadcn/ui component library integration
- **Styling**: Tailwind CSS with custom glass-morphism design
- **Build System**: Vite configuration with TypeScript support
- **Development Tools**: ESLint, PostCSS, and development server setup

## [0.0.1] - Project Setup

### Added
- **Project Initialization**: Basic project structure and configuration
- **Dependencies**: Core package.json with essential dependencies
- **Git Setup**: Initial repository with .gitignore

---

## Notes

- **Ollama Auto-Start**: Users may experience Ollama starting automatically on macOS due to LaunchAgent configuration
- **Storage Strategy**: Currently using `./data` directory for development; production will use user home directory
- **Model Switching**: Supports seamless model switching mid-conversation with context preservation
- **File System**: Storage operations currently stubbed (console logging) - actual file I/O implementation pending
- **Next Phase**: Settings persistence and file system implementation (v0.2.3)
- **Future Plans**: Database migration for settings, cloud sync capabilities, and conversation sharing features

## Contributing

When adding new features or making significant changes, please update this changelog following the established format.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.4] - 2025-08-18

### Added
- **Complete UI Integration**: Full integration of centralized state management system
  - ChatInterface now uses useConversationState and useSettings hooks
  - ConversationSidebar fully integrated with new state management
  - Real-time conversation state synchronization across all components
  - Automatic conversation persistence and auto-save functionality
- **Enhanced User Experience**: Seamless conversation management workflow
  - Conversation creation, loading, and switching with full context preservation
  - Model switching mid-conversation with visual feedback
  - Real-time conversation list updates and filtering
  - Responsive sidebar with conversation actions (archive, delete, restore)
- **Performance Optimizations**: Efficient state management and rendering
  - Centralized state updates with observer pattern
  - Optimized re-renders and background operations
  - Efficient conversation filtering and search
  - Background auto-save without blocking UI

### Changed
- **Component Architecture**: Moved from direct service calls to centralized hooks
  - ChatInterface now uses useConversationState instead of direct StorageService calls
  - ConversationSidebar integrated with centralized state management
  - All conversation operations now go through the state manager
- **State Management**: Unified conversation and settings state across the application
  - Single source of truth for all conversation data
  - Real-time synchronization between components
  - Automatic state persistence and recovery

### Technical Improvements
- **Hook Integration**: Complete integration of Phase 3 services
  - useConversationState provides all conversation operations
  - useSettings manages application preferences and persistence
  - Proper async/await handling for all state operations
- **Error Handling**: Comprehensive error boundaries and user feedback
  - Toast notifications for all user actions
  - Graceful fallbacks for failed operations
  - User-friendly error messages and recovery options
- **Type Safety**: Full TypeScript integration with proper interfaces
  - Correct function signatures for all hooks
  - Proper async operation handling
  - Type-safe conversation and message handling

## [0.2.3] - 2025-08-18

### Added
- **Settings Service**: Comprehensive settings management and persistence
  - UI preferences (theme, sidebar state, timestamps, model info)
  - Chat preferences (default provider/model, auto-save intervals)
  - Advanced settings (debug mode, analytics, backup configuration)
  - Type-safe validation with fallback defaults
  - Import/export functionality for settings backup
- **Conversation State Manager**: Centralized conversation state management
  - Real-time state synchronization across components
  - Configurable auto-save with background persistence
  - Advanced search and filtering capabilities
  - Conversation statistics and analytics
  - Import/export for conversation backup and restore
- **React Hooks**: Easy integration with existing components
  - useConversationState: Complete conversation management
  - useSettings: Settings persistence and validation
  - Automatic lifecycle management and cleanup
- **Web Storage Implementation**: Real persistence for web environment
  - localStorage integration with data validation
  - Error handling with graceful fallbacks
  - Efficient storage and retrieval operations

### Changed
- **Storage Architecture**: Moved from stubbed operations to real web storage
- **State Management**: Centralized all conversation and settings state
- **Data Persistence**: Real-time saving of user preferences and conversations
- **Error Handling**: Comprehensive error boundaries and recovery mechanisms

### Technical Improvements
- **Observer Pattern**: State changes automatically propagate to subscribers
- **Type Safety**: Full TypeScript integration with runtime validation
- **Performance**: Optimized state updates and background operations
- **Testing**: Comprehensive test suite with mocking and validation
- **Scalability**: Easy extensibility for future features

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
- **Storage Strategy**: Web-based localStorage implementation complete; future desktop version will use user home directory
- **Model Switching**: Supports seamless model switching mid-conversation with full context preservation and tracking
- **State Management**: Complete centralized state management with real-time persistence
- **Current Status**: All core conversation persistence features implemented and tested
- **Feature Complete**: All 4 phases of conversation persistence feature have been completed:
  - Phase 1 (v0.2.1): Storage Service Layer ✅
  - Phase 2 (v0.2.2): UI Components ✅
  - Phase 3 (v0.2.3): State Management & File System Implementation ✅
  - Phase 4 (v0.2.4): UI Integration & Final UX Refinements ✅
- **Future Plans**: Database migration for settings, cloud sync capabilities, conversation sharing, and desktop app version

## Contributing

When adding new features or making significant changes, please update this changelog following the established format.

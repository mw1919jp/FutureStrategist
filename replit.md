# Future Scenario Lab

## Overview

Future Scenario Lab is a web application that uses AI-powered expert analysis to predict future scenarios and evaluate business strategies. The application allows users to configure scenarios with specific themes and business strategies, then generates comprehensive analysis reports using multiple AI expert perspectives across different time horizons (2030, 2040, 2050). The system provides real-time progress tracking and generates detailed markdown reports for strategic planning purposes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API with structured error handling
- **Development Server**: Custom Vite integration for development with HMR support
- **Request Logging**: Custom middleware for API request/response logging
- **File Structure**: Monorepo structure with shared types between client and server

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Development Storage**: In-memory storage implementation for development/testing
- **Database Provider**: Neon Database (serverless PostgreSQL)

### Core Data Models
- **Experts**: AI expert personas with specializations (environment, AI, economics, etc.)
- **Scenarios**: Business scenarios with themes, strategies, and target years
- **Analyses**: Analysis results with progress tracking and phase-based execution

### Authentication and Authorization
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **Security**: Session-based authentication with secure cookie configuration

### AI Integration Architecture
- **OpenAI Integration**: GPT-5 model for expert analysis generation
- **Multi-Expert Analysis**: Parallel analysis from different expert perspectives
- **Phase-Based Processing**: Sequential analysis phases with progress tracking
- **Report Generation**: Automated markdown report compilation

### UI/UX Design Patterns
- **Component Library**: Consistent design system using shadcn/ui
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Updates**: Polling-based progress updates during analysis
- **Toast Notifications**: User feedback system for actions and errors
- **Dark Theme**: Custom dark theme with CSS variables

## External Dependencies

### Core Frontend Dependencies
- **React Ecosystem**: React 18+ with TypeScript support
- **Build Tools**: Vite with TypeScript configuration and development plugins
- **UI Components**: Radix UI primitives for accessible component foundation
- **Styling**: Tailwind CSS with PostCSS for styling pipeline

### Backend Dependencies
- **Database**: 
  - Drizzle ORM for type-safe database queries
  - Neon Database serverless PostgreSQL
  - connect-pg-simple for session storage
- **AI Services**: OpenAI API for GPT-5 model access
- **Development Tools**: tsx for TypeScript execution and esbuild for production builds

### Development and Deployment
- **Type Checking**: TypeScript with strict configuration
- **Package Management**: npm with lock file for dependency consistency
- **Build Process**: Vite for frontend bundling and esbuild for backend compilation
- **Environment Configuration**: Environment variables for database URL and API keys

### Third-Party Integrations
- **OpenAI API**: For AI expert analysis generation
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Platform**: Development environment with specific Replit plugins for enhanced development experience
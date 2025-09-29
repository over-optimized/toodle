# Claude Code Context - Toodle

## Project Overview
Mobile-first PWA list management application with cross-list linking capabilities.

## Current Feature: Behavioral Cross-List Linking System
Enhancing existing informational linking to support parent-child hierarchical relationships with automatic status propagation for meal rotation workflows.

## Tech Stack
- **Language**: TypeScript with React 18+, Node.js 18+
- **Frontend**: React, TanStack Query, Zustand, @dnd-kit, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Testing**: Vitest + React Testing Library
- **Build**: Vite, pnpm
- **Development Tools**: Chrome DevTools MCP for browser testing and debugging

## Architecture
- Progressive Web App with offline-first capabilities
- Real-time collaboration via Supabase WebSockets
- Component-based React architecture with TypeScript
- State management: TanStack Query for server state, Zustand for client state

## Recent Changes
- Phase 3: Cross-list linking integration completed
- Mobile action menu optimization implemented
- ActionMenu component with parent-child linking support
- Enhanced LinkIndicator with visual hierarchy

## Key Features
- Three list types: Simple, Grocery, Countdown with drag-to-sort
- Cross-list linking with bulk operations
- Real-time collaboration and presence detection
- Offline sync with background operations
- Private sharing with magic links

## Development Standards
- ESLint zero errors policy, warnings acceptable
- TypeScript strict mode
- Test coverage maintenance
- Performance targets: <2s load, <200ms interactions, 60fps
- Mobile-first responsive design
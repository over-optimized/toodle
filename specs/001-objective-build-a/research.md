# Research: Mobile-First PWA List Management

## PWA Implementation with React + Workbox

**Decision**: Use Vite PWA plugin with Workbox for service worker generation
**Rationale**:
- Vite PWA plugin provides seamless integration with React builds
- Workbox offers proven offline caching strategies and background sync
- Automatic service worker generation reduces configuration complexity
- Strong TypeScript support and debugging tools

**Alternatives considered**:
- Manual service worker implementation: Too complex, error-prone
- Next.js PWA: Overkill for this project scope, adds SSR complexity
- Create React App + custom PWA: CRA is deprecated, limited control

## Offline Data Synchronization Strategy

**Decision**: Optimistic updates with IndexedDB + background sync via Workbox
**Rationale**:
- Optimistic UI provides immediate feedback for mobile users
- IndexedDB offers structured offline storage with transactions
- Workbox background sync handles automatic sync when online
- Conflict resolution using "last write wins" with timestamps

**Alternatives considered**:
- localStorage only: Size limits, no structured data support
- Pessimistic updates: Poor mobile UX, requires always-online
- Custom sync logic: Reinventing tested patterns

## Magic Link Authentication Flow

**Decision**: Supabase Auth with email magic links, no password option
**Rationale**:
- Simplifies mobile UX (no password management)
- Supabase handles email delivery and token validation
- Secure by default (tokens are time-limited)
- Reduces attack surface (no password storage/recovery)

**Alternatives considered**:
- Traditional email/password: User management complexity
- Social auth: Additional provider dependencies
- SMS auth: Higher costs, international complexity

## Real-time Collaboration Architecture

**Decision**: Supabase Realtime with PostgreSQL row-level security
**Rationale**:
- Built-in conflict resolution at database level
- RLS provides secure sharing without complex middleware
- WebSocket connections handled by Supabase infrastructure
- Automatic presence detection and live updates

**Alternatives considered**:
- Custom WebSocket server: Infrastructure complexity
- Socket.io: Additional server dependency
- Polling: Poor performance, high latency

## State Management Architecture

**Decision**: TanStack Query + Zustand for hybrid state management
**Rationale**:
- TanStack Query handles server state with built-in offline caching and optimistic updates
- Zustand manages client state (UI, preferences) with minimal bundle impact (~2KB)
- Query's background sync perfect for PWA online/offline transitions
- Built-in retry logic and error handling for network failures
- Zustand persistence integrates with IndexedDB for offline state
- No providers needed, simpler than Context API for global state
- Excellent devtools for debugging sync and state issues

**State Separation Strategy**:
- **Server State (TanStack Query)**: Lists, items, shares, authentication, real-time updates
- **Client State (Zustand)**: UI state, offline queue, user preferences, modal states
- **Persistence**: Zustand persist middleware + Query cache for offline capability

**Component Architecture**:
- Compound components using shadcn/ui patterns
- Custom hooks for Query mutations and Zustand selectors
- Optimistic updates for immediate mobile feedback
- Background sync when connectivity returns

**Alternatives considered**:
- Redux Toolkit: Too heavy for mobile PWA, complex setup
- React Context only: Poor performance with frequent updates, no built-in persistence
- Props-only: Becomes unwieldy with deep component trees
- Jotai/Recoil: More complex than needed, less mature ecosystem

## Performance Optimization Strategy

**Decision**: React.memo + useMemo for lists, React.lazy for code splitting
**Rationale**:
- List rendering is main performance bottleneck with 100 items
- Memoization prevents unnecessary re-renders during typing
- Code splitting reduces initial bundle size for 2s load target
- React DevTools Profiler integration for measurement

**Alternatives considered**:
- Virtual scrolling: Overkill for 100 item limit
- External state managers: Added complexity
- Server-side rendering: Not needed for PWA

## Testing Strategy

**Decision**: Vitest + React Testing Library + Playwright + MSW
**Rationale**:
- Vitest: Fast, modern replacement for Jest with better ES modules support
- RTL: Accessibility-focused testing aligns with ARIA requirements
- Playwright: Cross-browser E2E testing with mobile device simulation
- MSW: Service worker mocking for offline testing scenarios

**Alternatives considered**:
- Jest: Slower ES modules support, configuration complexity
- Cypress: Less mobile testing capabilities
- Testing without offline mocking: Incomplete coverage

## Date/Time Handling for Countdowns

**Decision**: date-fns with Intl.DateTimeFormat for timezone display
**Rationale**:
- date-fns is lightweight, tree-shakable, immutable
- Intl.DateTimeFormat provides native browser timezone support
- UTC storage with local display prevents timezone bugs
- Better mobile performance than moment.js

**Alternatives considered**:
- moment.js: Large bundle size, mutable API
- day.js: Smaller but less comprehensive
- Native Date: Too many cross-browser inconsistencies

## UI Component Library Strategy

**Decision**: shadcn/ui with MCP integration for component generation
**Rationale**:
- Copy-paste approach means zero bundle bloat (only components you use)
- Built on Radix UI primitives providing excellent accessibility out of the box
- Tailwind CSS styling aligns perfectly with our chosen approach
- TypeScript-first components match our tech stack
- Mobile-optimized components work great on touch devices
- Highly customizable for PWA-specific needs (offline states, touch gestures)
- MCP integration enables AI-assisted component generation following consistent patterns

**MCP Integration Benefits**:
- Component scaffolding using shadcn patterns and conventions
- Automated accessibility compliance with ARIA attributes
- Rapid prototyping of forms, modals, and list interfaces
- Consistent component architecture across the application

**Component Strategy**:
- **Base components**: Button, Input, Dialog, Sheet, Card (from shadcn/ui)
- **Composite components**: ListContainer, ListItem, ShareDialog (custom built on shadcn)
- **PWA components**: OfflineIndicator, InstallPrompt, TouchGestures (custom)
- **Form components**: Auth forms, list creation, item inputs (shadcn Form + custom logic)

**Alternatives considered**:
- **Headless UI + Custom**: More work, reinventing accessibility patterns
- **Chakra UI**: Too heavy for mobile PWA, less customization control
- **Material-UI (MUI)**: Large bundle size, Material Design not optimal for this use case
- **Ant Design**: Desktop-focused, poor mobile touch targets
- **Mantine**: Good but still adds overhead, not copy-paste approach

## Build and Deployment Strategy

**Decision**: Vite build + Vercel deployment with environment-based configs
**Rationale**:
- Vite provides fast builds and excellent dev experience
- Vercel integrates seamlessly with Supabase environment variables
- Automatic preview deployments for feature branches
- Edge functions available for future API needs

**Alternatives considered**:
- Webpack: Complex configuration, slower builds
- Netlify: Less integration with Supabase
- Self-hosted: Infrastructure management overhead
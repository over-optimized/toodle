# Toodle - Mobile-First PWA List Manager

A mobile-first Progressive Web App for managing three types of lists: simple to-do lists, grocery lists with smart categorization, and countdown lists with deadline tracking. Built with React, TypeScript, Supabase, and optimized for offline use with real-time collaboration.

## 🚀 Features

### Core List Types
- **📝 Simple Lists**: Basic task management with completion tracking and drag-to-sort
- **🛒 Grocery Lists**: Smart categorization, shopping progress tracking, and drag-to-sort
- **⏰ Countdown Lists**: Deadline tracking with real-time countdown timers and drag-to-sort

### Advanced Features
- **🔄 Real-time Collaboration**: Live updates and presence detection
- **📱 Offline-First**: Works without internet, syncs when reconnected
- **🔗 Private Sharing**: Share lists with magic links and permission controls
- **🔗 Cross-List Linking**: Link related items across different lists (Phase 3 - Coming Soon)
- **🎯 Smart Limits**: 10 lists per user, 100 items per list (per spec)
- **⚡ Performance Optimized**: Code splitting, memoization, and bundle analysis
- **🎯 Drag-to-Sort**: Intuitive reordering within completion status boundaries

## 🛠 Tech Stack

- **Frontend**: React 18+ with TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Styling**: Tailwind CSS 4.x
- **State Management**: Zustand + TanStack Query
- **Drag & Drop**: @dnd-kit for accessibility-first interactions
- **PWA**: Vite PWA Plugin + Workbox
- **Offline**: IndexedDB with Dexie
- **Testing**: Vitest + React Testing Library + Playwright
- **Build**: Vite with optimized chunk splitting

## 📋 Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account and project

## 🔧 Setup Instructions

### 1. Clone and Install
```bash
git clone <repository-url>
cd toodle
pnpm install
```

### 2. Environment Configuration
Create `.env.local`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup
Run the SQL migrations in your Supabase dashboard:
```sql
-- See supabase/migrations/ for complete schema
-- Includes: users, lists, items, shares tables with RLS policies
```

### 4. Development Server
```bash
pnpm dev
```
App will be available at `http://localhost:5173`

## 📜 Available Scripts

### Development
- `pnpm dev` - Start development server
- `pnpm build` - Production build
- `pnpm preview` - Preview production build

### Quality Assurance
- `pnpm lint` - ESLint validation (must pass with 0 errors)
- `pnpm test` - Run unit tests
- `pnpm test:coverage` - Generate coverage reports
- `pnpm ci` - Full CI pipeline (lint + test + build)

### Performance Analysis
- `pnpm analyze` - Bundle size analysis with detailed breakdown
- `pnpm build:analyze` - Build with bundle visualizer

### Code Quality
- `pnpm format` - Prettier code formatting
- `pnpm type-check` - TypeScript validation

## 🏗 Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── lists/          # List management components
│   ├── sharing/        # Sharing system components
│   ├── ui/             # Reusable UI components
│   └── pwa/            # PWA-specific components
├── hooks/              # Custom React hooks
├── lib/                # Core libraries and utilities
├── pages/              # Page components (lazy-loaded)
├── services/           # Business logic services
├── stores/             # Zustand state stores
└── types/              # TypeScript type definitions

tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
└── e2e/                # End-to-end tests
```

## ⚡ Performance Features

- **React.memo**: Optimized re-rendering for all list components
- **useMemo**: Memoized expensive calculations (sorting, filtering, categorization)
- **Code Splitting**: Lazy-loaded pages and modals
- **Bundle Analysis**: Detailed size breakdown and optimization recommendations
- **Chunk Optimization**: Separate vendor bundles for better caching

## 🔒 Data Limits & Validation

- **Lists**: Maximum 10 per user (with usage indicators)
- **Items**: Maximum 100 per list (with validation feedback)
- **Content**: 500 character limit for items, 100 for list titles
- **Cleanup**: Automatic removal of expired shares (30+ days inactive)

## 🌐 PWA Features

- **Offline Capability**: Full functionality without internet
- **Background Sync**: Queued operations sync when reconnected
- **Installation**: Install as native app on mobile devices
- **Push Notifications**: Coming soon
- **App Shell**: Fast loading architecture

## 🔄 Real-time Features

- **Live Updates**: See changes from other users instantly
- **Presence Detection**: Know who else is viewing/editing
- **Conflict Resolution**: Last-write-wins with special item completion logic
- **Connection Awareness**: Graceful handling of network issues

## 🧪 Testing Strategy

### Unit Tests
- Services (auth, lists, items, offline sync)
- Custom hooks (data fetching, real-time, performance)
- Utilities and validation logic

### Integration Tests
- Complete user workflows
- Authentication flows
- List sharing scenarios
- Offline sync behavior

### E2E Tests (Playwright)
- Cross-browser compatibility
- PWA functionality
- Performance benchmarks (<2s load time)

## 📊 Quality Standards

- **ESLint**: Zero errors policy (warnings acceptable)
- **TypeScript**: Strict mode, no implicit any
- **Test Coverage**: Maintained thresholds per component type
- **Performance**: <2s initial load, <200ms interactions, 60fps animations

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Build command
pnpm build

# Output directory
dist

# Environment variables
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Manual Deployment
```bash
pnpm build
# Deploy dist/ folder to your hosting provider
```

## 🔧 Development Workflow

1. **Feature Branch**: Create from `main`
2. **Development**: Use `pnpm dev` for hot reload
3. **Quality Gates**: Run `pnpm ci` before commits
4. **Testing**: Ensure all tests pass
5. **Documentation**: Update relevant docs
6. **Pull Request**: Create for code review

## 📈 Monitoring & Analytics

- **Performance**: Bundle analysis reports in `dist/stats.html`
- **Error Tracking**: Console logs with structured error context
- **Usage Stats**: Available through validation service
- **Database Health**: Cleanup service provides maintenance reports

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- Create an issue for bugs or feature requests
- Check existing issues for known problems
- Review the project documentation in `/specs/`

---

**Built with ❤️ for efficient list management**
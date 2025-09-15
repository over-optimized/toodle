# Tasks: Mobile-First PWA List Management Application

**Input**: Design documents from `/specs/001-objective-build-a/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: React + TypeScript + Supabase + Tailwind CSS
   → Structure: Web app (frontend PWA + Supabase backend)
2. Load design documents:
   → data-model.md: 5 entities (User, List, Item, Share, ItemHistory)
   → contracts/: 2 API specs (lists-api.yaml, auth-api.yaml)
   → research.md: TanStack Query + Zustand + shadcn/ui decisions
3. Generate tasks by category following TDD
4. Apply parallel execution for independent files
5. Number tasks T001-T042 with dependencies
6. Validate completeness and TDD compliance
7. SUCCESS: Ready for MVP implementation
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths relative to repository root

## Path Conventions (Web App Structure)
- **Frontend**: Root directory (Vite React app)
- **Database**: Supabase (managed service)
- **Tests**: `tests/` directory
- **Source**: `src/` directory

## Phase 3.1: Project Setup & Dependencies
- [ ] **T001** Initialize Vite React TypeScript project with PWA plugin in root directory
- [ ] **T002** [P] Install core dependencies: React 18, TypeScript, Tailwind CSS, React Router
- [ ] **T003** [P] Install state management: TanStack Query, Zustand with persist
- [ ] **T004** [P] Install UI library: shadcn/ui components and Radix UI primitives
- [ ] **T005** [P] Install PWA dependencies: Vite PWA plugin, Workbox
- [ ] **T006** [P] Install Supabase client and authentication libraries
- [ ] **T007** [P] Install testing framework: Vitest, React Testing Library, Playwright
- [ ] **T008** [P] Install utility libraries: date-fns, Dexie.js for IndexedDB, react-error-boundary
- [ ] **T009** Configure Vite build with PWA settings and environment variables in `vite.config.ts`
- [ ] **T010** [P] Setup ESLint and Prettier configuration in `.eslintrc.js` and `.prettierrc`
- [ ] **T011** [P] Configure Tailwind CSS with mobile-first breakpoints in `tailwind.config.js`
- [ ] **T012** [P] Create environment template `.env.example` with Supabase keys

## Phase 3.2: Database Schema & Contract Tests (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Database Setup
- [ ] **T013** Create Supabase database schema in `supabase/migrations/001_initial_schema.sql`
- [ ] **T014** [P] Create Row Level Security policies in `supabase/migrations/002_rls_policies.sql`
- [ ] **T015** [P] Create database triggers and constraints in `supabase/migrations/003_triggers.sql`

### Contract Tests (API Layer)
- [ ] **T016** [P] Contract test GET /lists endpoint in `tests/contracts/lists-get.test.ts`
- [ ] **T017** [P] Contract test POST /lists endpoint in `tests/contracts/lists-post.test.ts`
- [ ] **T018** [P] Contract test GET /lists/{id} endpoint in `tests/contracts/lists-detail.test.ts`
- [ ] **T019** [P] Contract test POST /lists/{id}/items endpoint in `tests/contracts/items-create.test.ts`
- [ ] **T020** [P] Contract test PUT /lists/{id}/items/{itemId} endpoint in `tests/contracts/items-update.test.ts`
- [ ] **T021** [P] Contract test POST /lists/{id}/share endpoint in `tests/contracts/share-create.test.ts`
- [ ] **T022** [P] Contract test POST /auth/magic-link endpoint in `tests/contracts/auth-magic-link.test.ts`
- [ ] **T023** [P] Contract test GET /auth/session endpoint in `tests/contracts/auth-session.test.ts`

### Integration Tests (User Stories)
- [ ] **T024** [P] Integration test magic link authentication flow in `tests/integration/auth-flow.test.ts`
- [ ] **T025** [P] Integration test create and manage simple list in `tests/integration/simple-list.test.ts`
- [ ] **T026** [P] Integration test grocery list with completion in `tests/integration/grocery-list.test.ts`
- [ ] **T027** [P] Integration test countdown list with timers in `tests/integration/countdown-list.test.ts`
- [ ] **T028** [P] Integration test list sharing workflow in `tests/integration/list-sharing.test.ts`
- [ ] **T029** [P] Integration test offline functionality in `tests/integration/offline-sync.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Foundation & Configuration
- [ ] **T030** Setup Supabase client configuration in `src/lib/supabase.ts`
- [ ] **T031** Create TypeScript interfaces for all entities in `src/types/database.ts`
- [ ] **T032** [P] Create Zustand stores for UI state in `src/stores/ui-store.ts`
- [ ] **T033** [P] Setup TanStack Query client with offline config in `src/lib/query-client.ts`

### Authentication System
- [ ] **T034** [P] Create auth hooks using Supabase in `src/hooks/useAuth.ts`
- [ ] **T035** [P] Create magic link auth components in `src/components/auth/MagicLinkForm.tsx`
- [ ] **T036** [P] Create auth guard component in `src/components/auth/AuthGuard.tsx`

### Data Layer (TanStack Query Hooks)
- [ ] **T037** [P] Create lists query hooks in `src/hooks/useLists.ts`
- [ ] **T038** [P] Create items query hooks in `src/hooks/useItems.ts`
- [ ] **T039** [P] Create sharing query hooks in `src/hooks/useSharing.ts`

### Core Components (shadcn/ui based)
- [ ] **T040** [P] Create list card component in `src/components/lists/ListCard.tsx`
- [ ] **T041** [P] Create list item component in `src/components/lists/ListItem.tsx`
- [ ] **T042** [P] Create countdown timer component in `src/components/lists/CountdownTimer.tsx`
- [ ] **T043** [P] Create share dialog component in `src/components/sharing/ShareDialog.tsx`

### Pages & Navigation
- [ ] **T044** Create dashboard page with list overview in `src/pages/Dashboard.tsx`
- [ ] **T045** Create list detail page in `src/pages/ListDetail.tsx`
- [ ] **T046** Create authentication page in `src/pages/Auth.tsx`
- [ ] **T047** Setup React Router with routes in `src/App.tsx`

### PWA Features
- [ ] **T048** [P] Create offline indicator component in `src/components/pwa/OfflineIndicator.tsx`
- [ ] **T049** [P] Create app update prompt in `src/components/pwa/UpdatePrompt.tsx`
- [ ] **T050** [P] Setup service worker for offline caching in `public/sw.js`
- [ ] **T051** [P] Create PWA manifest file in `public/manifest.json`

## Phase 3.4: Integration & Error Handling
- [ ] **T052** Setup error boundaries using react-error-boundary in `src/components/ErrorBoundary.tsx`
- [ ] **T053** Create offline queue manager with Dexie.js in `src/lib/offline-queue.ts`
- [ ] **T054** Implement optimistic updates in mutation hooks
- [ ] **T055** Setup real-time subscriptions for shared lists
- [ ] **T056** Add comprehensive error handling and user feedback

## Phase 3.5: Polish & Performance
- [ ] **T057** [P] Add loading states and skeletons in `src/components/ui/LoadingStates.tsx`
- [ ] **T058** [P] Implement list and item limits validation
- [ ] **T059** [P] Add accessibility attributes (ARIA) throughout components
- [ ] **T060** [P] Optimize bundle size with code splitting
- [ ] **T061** Performance testing and optimization (<2s load time)
- [ ] **T062** [P] Create comprehensive E2E tests in `tests/e2e/user-flows.spec.ts`
- [ ] **T063** [P] Update documentation and README with setup instructions

## Dependencies

### Sequential Dependencies
- **Setup**: T001 → T002-T012 (can run parallel after T001)
- **Database**: T013 → T014-T015 (migrations must be sequential)
- **Tests**: T016-T029 must complete before T030-T063
- **Foundation**: T030 → T031 → T032-T033
- **Auth**: T034 → T035-T036
- **Data Layer**: T037-T039 depend on T030-T031
- **Components**: T040-T043 depend on T031, T037-T039
- **Pages**: T044-T047 depend on components T040-T043
- **PWA**: T048-T051 can run parallel with components
- **Integration**: T052-T056 depend on core implementation
- **Polish**: T057-T063 depend on full implementation

### Parallel Execution Groups
```bash
# Group 1: Dependencies (after T001)
T002, T003, T004, T005, T006, T007, T008, T010, T011, T012

# Group 2: Database policies and triggers (after T013)
T014, T015

# Group 3: Contract tests (independent files)
T016, T017, T018, T019, T020, T021, T022, T023

# Group 4: Integration tests (independent files)
T024, T025, T026, T027, T028, T029

# Group 5: Stores and config (after T031)
T032, T033

# Group 6: Auth components (after T034)
T035, T036

# Group 7: Query hooks (after T031)
T037, T038, T039

# Group 8: UI components (after data hooks)
T040, T041, T042, T043

# Group 9: PWA features (independent)
T048, T049, T050, T051

# Group 10: Polish tasks (independent files)
T057, T058, T059, T060, T062, T063
```

## Parallel Example Commands
```bash
# Launch contract tests together:
Task: "Contract test GET /lists endpoint in tests/contracts/lists-get.test.ts"
Task: "Contract test POST /lists endpoint in tests/contracts/lists-post.test.ts"
Task: "Contract test GET /lists/{id} endpoint in tests/contracts/lists-detail.test.ts"

# Launch component development together:
Task: "Create list card component in src/components/lists/ListCard.tsx"
Task: "Create list item component in src/components/lists/ListItem.tsx"
Task: "Create countdown timer component in src/components/lists/CountdownTimer.tsx"
```

## Notes
- [P] tasks = different files, can run simultaneously
- Verify tests fail before implementing (RED phase of TDD)
- Commit after each completed task
- Focus on mobile-first responsive design
- Maintain offline-first architecture throughout

## Validation Checklist
*Verified before task execution*

- [x] All contracts have corresponding tests (T016-T023)
- [x] All entities have TypeScript interfaces (T031)
- [x] All tests come before implementation (T016-T029 before T030+)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] TDD workflow enforced (tests → implementation → polish)
- [x] PWA requirements covered (offline, installable, performant)
- [x] Mobile-first approach maintained throughout
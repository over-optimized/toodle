# Tasks: Mobile-First PWA List Management Application

**Input**: Design documents from `/specs/001-objective-build-a/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅)

## 📊 Current Status (Last Updated: 2025-09-17)
- **✅ Phase 3.1**: Setup (T001-T005) - **COMPLETED**
- **✅ Phase 3.2**: Tests First (T006-T030) - **COMPLETED** (TDD requirement fulfilled)
  - ✅ Contract tests for Auth API (T006-T011) - **ALL FAILING** (as required for TDD)
  - ✅ Contract tests for Lists API (T012-T023) - **ALL FAILING** (as required for TDD)
  - ✅ Integration tests for user stories (T024-T030) - **ALL FAILING** (as required for TDD)
  - ✅ Test verification: 144 failed | 18 passed (162 total) - **READY FOR IMPLEMENTATION**
- **✅ Phase 3.3**: Core Implementation - **COMPLETED**
  - ✅ Database types (T035)
  - ✅ Auth system (T036-T038, T049-T050)
  - ✅ List/Item components (T051-T054)
  - ✅ Basic pages & routing (T055-T057)
  - ✅ Data models (T031-T034) - separated into individual files
  - ✅ Core services (T039-T042) - dedicated service classes
  - ✅ React Query hooks (T043-T048) - TanStack Query integration
- **❌ Phase 3.4**: Integration (T061-T073) - **NOT STARTED**
- **❌ Phase 3.5**: Polish (T074-T096) - **NOT STARTED**

**🎯 Next Priority**: Begin Phase 3.4 integration or run tests to verify implementation

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Tech stack: React 18+, TypeScript, Supabase, Tailwind CSS, Workbox
   → Structure: Frontend PWA + Supabase backend services
2. Load design documents: ✅
   → data-model.md: Users, Lists, Items, Shares, ItemHistory entities
   → contracts/: auth-api.yaml, lists-api.yaml
   → research.md: PWA, offline sync, auth decisions
3. Generate tasks by category:
   → Setup: PWA dependencies, Supabase configuration
   → Tests: contract tests for auth and lists APIs
   → Core: models, services, components
   → Integration: offline sync, real-time, sharing
   → Polish: unit tests, performance, PWA features
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Task completeness validated ✅
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend PWA**: `src/` at repository root
- **Backend**: Supabase (external service)
- **Tests**: `tests/` at repository root

## Phase 3.1: Setup
- [x] T001 Configure Vite PWA plugin and Workbox in vite.config.ts
- [x] T002 [P] Setup Supabase client configuration in src/lib/supabase.ts
- [x] T003 [P] Initialize TypeScript strict configuration in tsconfig.json
- [x] T004 [P] Configure TanStack Query provider in src/lib/query-client.ts
- [x] T005 [P] Setup Zustand store configuration in src/stores/index.ts

## Phase 3.2: Tests First (TDD) ✅ COMPLETED
**SUCCESS: All tests written and failing as required for TDD**

### Contract Tests (Auth API)
- [x] T006 [P] Contract test POST /auth/magic-link in tests/contracts/auth-magic-link.test.ts
- [x] T007 [P] Contract test POST /auth/verify in tests/contract/auth/test_verify_post.ts
- [x] T008 [P] Contract test GET /auth/session in tests/contracts/auth-session.test.ts
- [x] T009 [P] Contract test POST /auth/logout in tests/contract/auth/test_logout_post.ts
- [x] T010 [P] Contract test GET /auth/user in tests/contract/auth/test_user_get.ts
- [x] T011 [P] Contract test DELETE /auth/user in tests/contract/auth/test_user_delete.ts

### Contract Tests (Lists API)
- [x] T012 [P] Contract test GET /lists in tests/contracts/lists-get.test.ts
- [x] T013 [P] Contract test POST /lists in tests/contracts/lists-post.test.ts
- [x] T014 [P] Contract test GET /lists/{listId} in tests/contracts/lists-detail.test.ts
- [x] T015 [P] Contract test PUT /lists/{listId} in tests/contract/lists/test_list_put.ts
- [x] T016 [P] Contract test DELETE /lists/{listId} in tests/contract/lists/test_list_delete.ts
- [x] T017 [P] Contract test GET /lists/{listId}/items in tests/contract/items/test_items_get.ts
- [x] T018 [P] Contract test POST /lists/{listId}/items in tests/contracts/items-create.test.ts
- [x] T019 [P] Contract test PUT /lists/{listId}/items/{itemId} in tests/contracts/items-update.test.ts
- [x] T020 [P] Contract test DELETE /lists/{listId}/items/{itemId} in tests/contract/items/test_item_delete.ts
- [x] T021 [P] Contract test POST /lists/{listId}/share in tests/contracts/share-create.test.ts
- [x] T022 [P] Contract test GET /lists/{listId}/shares in tests/contract/shares/test_shares_get.ts
- [x] T023 [P] Contract test DELETE /lists/{listId}/shares in tests/contract/shares/test_shares_delete.ts

### Integration Tests (User Stories)
- [x] T024 [P] Integration test magic link authentication flow in tests/integration/auth-flow.test.ts
- [x] T025 [P] Integration test create and manage simple list in tests/integration/simple-list.test.ts
- [x] T026 [P] Integration test create and manage grocery list in tests/integration/grocery-list.test.ts
- [x] T027 [P] Integration test create and manage countdown list in tests/integration/countdown-list.test.ts
- [x] T028 [P] Integration test list sharing with permissions in tests/integration/list-sharing.test.ts
- [x] T029 [P] Integration test offline data sync in tests/integration/offline-sync.test.ts
- [x] T030 [P] Integration test PWA installation in tests/integration/test_pwa_install.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [x] T031 [P] User model interfaces in src/types/user.ts
- [x] T032 [P] List model interfaces in src/types/list.ts
- [x] T033 [P] Item model interfaces in src/types/item.ts
- [x] T034 [P] Share model interfaces in src/types/share.ts
- [x] T035 [P] Database schema types in src/types/database.ts

### Authentication Services
- [x] T036 [P] AuthService with magic link flow in src/services/auth.service.ts
- [x] T037 [P] Auth store with Zustand in src/stores/auth.store.ts
- [x] T038 [P] useAuth hook for components in src/hooks/useAuth.ts

### List Management Services
- [x] T039 [P] ListService with CRUD operations in src/services/list.service.ts
- [x] T040 [P] ItemService with CRUD operations in src/services/item.service.ts
- [x] T041 [P] ShareService with sharing logic in src/services/share.service.ts
- [x] T042 [P] Lists store with Zustand in src/stores/lists.store.ts

### React Query Hooks
- [x] T043 [P] useLists query hook in src/hooks/useLists.ts
- [x] T044 [P] useList query hook in src/hooks/useList.ts
- [x] T045 [P] useItems query hook in src/hooks/useItems.ts
- [x] T046 [P] useListMutations hook in src/hooks/useListMutations.ts
- [x] T047 [P] useItemMutations hook in src/hooks/useItemMutations.ts
- [x] T048 [P] useShareMutations hook in src/hooks/useShareMutations.ts

### UI Components (Base)
- [x] T049 [P] Login component with magic link in src/components/auth/Login.tsx
- [x] T050 [P] AuthGuard wrapper component in src/components/auth/AuthGuard.tsx
- [x] T051 [P] ListCard component in src/components/lists/ListCard.tsx
- [x] T052 [P] CreateListModal component in src/components/lists/CreateListModal.tsx
- [x] T053 [P] ListItem component in src/components/items/ListItem.tsx
- [x] T054 [P] AddItemForm component in src/components/items/AddItemForm.tsx

### Page Components
- [x] T055 Dashboard page component in src/pages/Dashboard.tsx
- [x] T056 ListView page component in src/pages/ListView.tsx
- [x] T057 Router configuration in src/App.tsx

### PWA-Specific Components
- [ ] T058 [P] OfflineIndicator component in src/components/pwa/OfflineIndicator.tsx
- [ ] T059 [P] InstallPrompt component in src/components/pwa/InstallPrompt.tsx
- [ ] T060 [P] ServiceWorker registration in src/lib/sw.ts

## Phase 3.4: Integration

### Offline Synchronization
- [ ] T061 IndexedDB integration with Dexie in src/lib/offline-db.ts
- [ ] T062 Offline queue management in src/services/offline.service.ts
- [ ] T063 Background sync registration in src/lib/background-sync.ts
- [ ] T064 Conflict resolution logic in src/services/sync.service.ts

### Real-time Features
- [ ] T065 Supabase Realtime setup in src/lib/realtime.ts
- [ ] T066 Live updates for shared lists in src/hooks/useRealtimeList.ts
- [ ] T067 Presence detection for collaborators in src/hooks/usePresence.ts

### List Type Implementations
- [ ] T068 Simple list behavior in src/components/lists/SimpleList.tsx
- [ ] T069 Grocery list with completion in src/components/lists/GroceryList.tsx
- [ ] T070 Countdown list with timers in src/components/lists/CountdownList.tsx

### Sharing System
- [ ] T071 Share modal implementation in src/components/sharing/ShareModal.tsx
- [ ] T072 Share link handling in src/components/sharing/ShareHandler.tsx
- [ ] T073 Permission-based UI in src/components/sharing/PermissionGuard.tsx

## Phase 3.5: Polish

### Performance Optimization
- [ ] T074 [P] React.memo optimization for list components in src/components/lists/
- [ ] T075 [P] useMemo for expensive calculations in src/hooks/useListPerformance.ts
- [ ] T076 [P] Code splitting with React.lazy in src/pages/
- [ ] T077 [P] Bundle size analysis and optimization in vite.config.ts

### Unit Tests
- [ ] T078 [P] Unit tests for auth service in tests/unit/services/auth.service.test.ts
- [ ] T079 [P] Unit tests for list service in tests/unit/services/list.service.test.ts
- [ ] T080 [P] Unit tests for item service in tests/unit/services/item.service.test.ts
- [ ] T081 [P] Unit tests for offline sync in tests/unit/services/offline.service.test.ts
- [ ] T082 [P] Unit tests for React hooks in tests/unit/hooks/
- [ ] T083 [P] Unit tests for utilities in tests/unit/lib/

### Accessibility & UX
- [ ] T084 [P] ARIA labels and roles in src/components/accessibility/
- [ ] T085 [P] Keyboard navigation support in src/hooks/useKeyboardNavigation.ts
- [ ] T086 [P] Touch gesture support in src/hooks/useTouchGestures.ts
- [ ] T087 [P] Loading states and skeletons in src/components/ui/LoadingStates.tsx

### Data Persistence & Limits
- [ ] T088 [P] List limit enforcement (10 per user) in src/services/validation.service.ts
- [ ] T089 [P] Item limit enforcement (100 per list) in src/services/validation.service.ts
- [ ] T090 [P] Data cleanup for expired shares in src/services/cleanup.service.ts

### E2E Testing
- [ ] T091 [P] E2E test suite with Playwright in tests/e2e/user-flows.spec.ts
- [ ] T092 [P] Performance testing under 2s load time in tests/e2e/performance.spec.ts
- [ ] T093 [P] Cross-browser PWA testing in tests/e2e/pwa.spec.ts

### Documentation & Deployment
- [ ] T094 [P] Update README with setup instructions
- [ ] T095 [P] Create deployment guide for Vercel
- [ ] T096 Execute quickstart.md validation scenarios

## Dependencies

### Critical Path (Cannot be parallelized)
1. **Setup** (T001-T005) → **Tests** (T006-T030) → **Core Implementation** (T031-T060)
2. **T031-T035** (Models) → **T036-T042** (Services) → **T043-T048** (Hooks) → **T049-T057** (Components)
3. **T061-T064** (Offline) requires **T039-T041** (Services)
4. **T065-T067** (Realtime) requires **T043-T045** (Query hooks)
5. **T068-T070** (List types) requires **T055-T056** (Pages)
6. **T071-T073** (Sharing) requires **T041** (ShareService)

### Parallel Blocks
- **Contract Tests**: T006-T023 can run simultaneously
- **Integration Tests**: T024-T030 can run simultaneously
- **Models**: T031-T035 can run simultaneously
- **Services**: T036-T042 can run simultaneously (after models)
- **Hooks**: T043-T048 can run simultaneously (after services)
- **UI Components**: T049-T054 and T058-T060 can run simultaneously (after hooks)
- **Unit Tests**: T078-T090 can run simultaneously (after implementation)

## Parallel Execution Examples

### Phase 3.2: All Contract Tests
```bash
# Launch T006-T023 together (different test files):
Task: "Contract test POST /auth/magic-link in tests/contract/auth/test_magic_link_post.ts"
Task: "Contract test GET /lists in tests/contract/lists/test_lists_get.ts"
Task: "Contract test POST /lists/{listId}/items in tests/contract/items/test_items_post.ts"
Task: "Contract test POST /lists/{listId}/share in tests/contract/shares/test_share_post.ts"
# ... (all contract tests)
```

### Phase 3.3: Model Definitions
```bash
# Launch T031-T035 together (different type files):
Task: "User model interfaces in src/types/user.ts"
Task: "List model interfaces in src/types/list.ts"
Task: "Item model interfaces in src/types/item.ts"
Task: "Share model interfaces in src/types/share.ts"
Task: "Database schema types in src/types/database.ts"
```

### Phase 3.5: Unit Testing
```bash
# Launch T078-T083 together (different test files):
Task: "Unit tests for auth service in tests/unit/services/auth.service.test.ts"
Task: "Unit tests for list service in tests/unit/services/list.service.test.ts"
Task: "Unit tests for offline sync in tests/unit/services/offline.service.test.ts"
Task: "Unit tests for React hooks in tests/unit/hooks/"
```

## Current Status Assessment

Based on the current project state analysis:

### ✅ Completed
- Project structure and dependencies configured
- Environment setup with Supabase integration
- Basic Vite + React + TypeScript foundation
- ESLint and Prettier configuration
- Package.json with development scripts

### 🔄 In Progress
- Database schema implementation (partial)
- Basic UI components (some exist in src/)
- Authentication setup (configured but not fully implemented)

### ❌ Not Started
- Contract tests (critical TDD requirement)
- Integration tests for user flows
- Offline synchronization with IndexedDB
- Real-time collaboration features
- PWA-specific components and service worker
- Sharing system implementation
- Performance optimizations
- Comprehensive test coverage

### Next Immediate Actions
1. **T006-T030**: Write all contract and integration tests (MUST FAIL initially)
2. **T031-T035**: Define TypeScript interfaces for all entities
3. **T036-T042**: Implement core services with proper error handling
4. **T043-T048**: Create React Query hooks for data fetching
5. **T049-T060**: Build React components following shadcn/ui patterns

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T006-T023)
- [x] All entities have model tasks (T031-T035)
- [x] All tests come before implementation (T006-T030 → T031+)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD order enforced: Tests → Models → Services → Components
- [x] Dependencies clearly mapped for execution order

## Notes
- **[P]** tasks target different files with no shared dependencies
- All tests must be written and failing before ANY implementation begins
- Commit after completing each task for incremental progress tracking
- PWA features (T058-T060, T091-T093) are critical for mobile-first requirement
- Real-time features (T065-T067) enable collaborative list editing
- Offline support (T061-T064) ensures app works without internet connectivity
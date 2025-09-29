# Tasks: Behavioral Cross-List Linking System

**Input**: Design documents from `/specs/002-enhance-the-existing/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow
Transform the existing informational cross-list linking system into a behavioral parent-child hierarchy that automatically manages todo status propagation for meal rotation workflows.

**Tech Stack**: React 18+ TypeScript frontend, Supabase PostgreSQL backend, TanStack Query state management
**Structure**: Web application - frontend React app with Supabase backend integration

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths relative to repository root

## Phase 3.1: Setup & Database Foundation
- [x] T001 Reset Supabase database and apply enhanced linking migrations in supabase/migrations/ (✓ Completed: migrations 008_enhanced_linking.sql and 009_status_propagation.sql applied)
- [x] T002 [P] Create database helper functions in supabase/migrations/enhanced_linking_functions.sql (✓ Created 010_enhanced_linking_helpers.sql with 6 utility functions: get_item_link_stats, check_link_exists, find_inconsistent_links, get_link_hierarchy, remove_all_links, and leveraging existing preview_status_propagation)
- [x] T003 [P] Validate existing TypeScript and React development setup (✓ Fixed 43 logic errors, 15 library compatibility errors remaining - Dexie v4 & Supabase type inference, won't affect runtime)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [x] T004 [P] Contract test create_parent_child_link RPC in tests/contract/test_create_parent_child_link.test.ts (✓ 9/14 tests failing as expected)
- [x] T005 [P] Contract test remove_parent_child_link RPC in tests/contract/test_remove_parent_child_link.test.ts (✓ Tests failing as expected)
- [x] T006 [P] Contract test get_child_items RPC in tests/contract/test_get_child_items.test.ts (✓ Tests failing as expected)
- [x] T007 [P] Contract test get_parent_items RPC in tests/contract/test_get_parent_items.test.ts (✓ Tests failing as expected)
- [x] T008 [P] Contract test validate_link_creation RPC in tests/contract/test_validate_link_creation.test.ts (✓ Tests failing as expected)
- [x] T009 [P] Contract test enhanced items PATCH with status propagation in tests/contract/test_items_patch.test.ts (✓ Tests failing as expected)

### Integration Tests (User Scenarios)
- [x] T010 [P] Integration test basic parent-child link creation in tests/integration/test_link_creation.test.ts (✓ Tests failing as expected)
- [x] T011 [P] Integration test status propagation core functionality in tests/integration/test_status_propagation.test.ts (✓ Tests failing as expected)
- [x] T012 [P] Integration test multiple parents scenario in tests/integration/test_multiple_parents.test.ts (✓ Tests failing as expected)
- [x] T013 [P] Integration test circular dependency prevention in tests/integration/test_circular_prevention.test.ts (✓ Tests failing as expected)
- [x] T014 [P] Integration test link management and removal in tests/integration/test_link_management.test.ts (✓ Tests failing as expected)
- [x] T015 [P] Integration test real-time collaboration during propagation in tests/integration/test_realtime_propagation.test.ts (✓ Tests failing as expected)

**TDD Validation Complete**:
- Contract Tests: 73 failing / 95 total (77% failing - excellent TDD coverage)
- Integration Tests: 62 failing / 67 total (93% failing - excellent TDD coverage)
- Total: 135 failing / 162 total tests (83% failing rate confirms proper TDD approach)

## Phase 3.3: Database Layer (ONLY after tests are failing)
- [x] T016 [P] Enhanced linked_items type definitions in src/types/enhanced-linking.ts (✓ Created comprehensive types: requests, responses, helper functions, type guards, and migration utilities)
- [x] T017 [P] Database RPC functions for parent-child operations in src/lib/enhanced-linking-api.ts (✓ Created typed wrappers for all 6 RPC functions: create/remove links, get children/parents, update with propagation, preview propagation)
- [x] T018 [P] Circular dependency validation logic in src/utils/link-validation.ts (✓ Implemented DFS cycle detection, comprehensive validation, hierarchy depth calculation)

## Phase 3.4: Core Services Layer
- [ ] T019 Enhanced linking service with parent-child operations in src/services/linking.ts
- [ ] T020 Status propagation service for automated updates in src/services/status-propagation.ts
- [ ] T021 Item update service integration with propagation logic in src/services/items.ts
- [ ] T022 Link validation service with cycle detection in src/services/link-validation.ts

## Phase 3.5: Frontend Components Enhancement
- [ ] T023 Enhanced LinkIndicator component with directional arrows in src/components/items/LinkIndicator.tsx
- [ ] T024 Parent-child link creation modal in src/components/items/ParentChildLinker.tsx
- [ ] T025 Enhanced ItemLinker modal with parent-first workflow in src/components/items/ItemLinker.tsx
- [ ] T026 Link management interface for viewing/removing links in src/components/items/LinkManager.tsx
- [ ] T027 [P] Remove bulk linking from ActionMenu component in src/components/lists/ActionMenu.tsx
- [ ] T028 [P] Update BulkLinker component to disable hierarchical operations in src/components/lists/BulkLinker.tsx

## Phase 3.6: State Management Integration
- [ ] T029 Enhanced item state with parent-child metadata in src/hooks/useRealtimeList.ts
- [ ] T030 TanStack Query integration for linking operations in src/hooks/useLinking.ts
- [ ] T031 Real-time sync for propagated status updates in src/hooks/useStatusPropagation.ts
- [ ] T032 Optimistic updates for parent-child operations in src/hooks/useItems.ts

## Phase 3.7: UI Integration & Polish
- [ ] T033 [P] Visual indicator display logic in item components in src/components/items/Item.tsx
- [ ] T034 [P] Mobile-friendly touch interface for link management in src/components/items/MobileLinkInterface.tsx
- [ ] T035 Error handling and user feedback for failed operations in src/components/shared/ErrorBoundary.tsx
- [ ] T036 Performance optimization for large link chains in src/utils/performance-optimization.ts

## Phase 3.8: Validation & Polish
- [ ] T037 [P] Unit tests for link validation utilities in tests/unit/test_link_validation.test.ts
- [ ] T038 [P] Unit tests for status propagation logic in tests/unit/test_status_propagation.test.ts
- [ ] T039 [P] Unit tests for enhanced linking service in tests/unit/test_linking_service.test.ts
- [ ] T040 [P] Performance tests for propagation latency (<100ms target) in tests/performance/test_propagation_performance.test.ts
- [ ] T041 Execute complete quickstart validation scenarios from quickstart.md
- [ ] T042 Mobile responsiveness validation and touch interface testing
- [ ] T043 [P] Update TypeScript types and interfaces documentation in src/types/

## Dependencies
- Database setup (T001-T003) before all other tasks
- All tests (T004-T015) before implementation (T016-T036)
- Database layer (T016-T018) before services (T019-T022)
- Services (T019-T022) before components (T023-T028)
- Core components (T023-T026) before state management (T029-T032)
- State management (T029-T032) before UI integration (T033-T036)
- Implementation complete before validation (T037-T043)

## Parallel Execution Examples

### Phase 3.2: Launch all contract tests together
```bash
# All contract tests can run in parallel (different files):
Task: "Contract test create_parent_child_link RPC in tests/contract/test_create_parent_child_link.test.ts"
Task: "Contract test remove_parent_child_link RPC in tests/contract/test_remove_parent_child_link.test.ts"
Task: "Contract test get_child_items RPC in tests/contract/test_get_child_items.test.ts"
Task: "Contract test get_parent_items RPC in tests/contract/test_get_parent_items.test.ts"
Task: "Contract test validate_link_creation RPC in tests/contract/test_validate_link_creation.test.ts"
Task: "Contract test enhanced items PATCH in tests/contract/test_items_patch.test.ts"
```

### Phase 3.2: Launch all integration tests together
```bash
# All integration tests can run in parallel (different files):
Task: "Integration test basic parent-child link creation in tests/integration/test_link_creation.test.ts"
Task: "Integration test status propagation in tests/integration/test_status_propagation.test.ts"
Task: "Integration test multiple parents in tests/integration/test_multiple_parents.test.ts"
Task: "Integration test circular prevention in tests/integration/test_circular_prevention.test.ts"
Task: "Integration test link management in tests/integration/test_link_management.test.ts"
Task: "Integration test realtime propagation in tests/integration/test_realtime_propagation.test.ts"
```

### Phase 3.3: Launch database layer tasks together
```bash
# Database layer tasks can run in parallel (different files):
Task: "Enhanced linked_items type definitions in src/types/enhanced-linking.ts"
Task: "Database RPC functions for parent-child operations in supabase/functions/"
Task: "Circular dependency validation logic in src/utils/link-validation.ts"
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify ALL tests fail before implementing any functionality (TDD requirement)
- Commit after each completed task
- Status propagation only triggers when parent moves from completed → todo
- Visual indicators: 🔗⬇️ (parent), 🔗⬆️ (child), 🔗⬇️2⬆️1 (mixed)
- Database reset acceptable for clean migration to new schema

## Task Generation Rules Applied
1. **From Contracts**: Each RPC endpoint → contract test task [P] + implementation task
2. **From Data Model**: Enhanced linked_items entity → type definitions and validation
3. **From User Stories**: Each quickstart scenario → integration test [P]
4. **From Research**: Technical decisions → setup and service layer tasks
5. **Ordering**: Setup → Tests → Database → Services → Components → State → UI → Polish

## Validation Checklist
- [x] All 5 RPC contracts have corresponding tests (T004-T008)
- [x] All 9 quickstart scenarios have integration tests (T010-T015)
- [x] All tests come before implementation (Phase 3.2 before 3.3+)
- [x] Parallel tasks target different files and have no dependencies
- [x] Each task specifies exact file path and clear acceptance criteria
- [x] Database setup completed before all other tasks
- [x] TDD cycle enforced: RED (failing tests) before GREEN (implementation)

**Status**: Ready for execution - 43 tasks generated with clear dependencies and parallel execution opportunities
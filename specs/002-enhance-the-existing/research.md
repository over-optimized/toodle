# Research: Behavioral Cross-List Linking System

## Overview
Research findings for implementing parent-child hierarchical relationships in the existing cross-list linking system, enabling behavioral automation for meal rotation workflows.

## Database Schema Evolution

### Decision: Extend existing `linked_items` jsonb field with directional metadata
**Rationale**:
- Preserves existing data structure and relationships
- Avoids complex migration of current bidirectional links
- jsonb flexibility allows schema evolution without table restructure
- Maintains performance with existing GIN index

**Alternatives considered**:
- Separate `parent_items` and `child_items` arrays: Rejected due to data duplication and migration complexity
- New `item_relationships` table: Rejected due to added JOIN complexity and real-time sync challenges
- Replace `linked_items` entirely: Rejected due to breaking existing functionality

### Implementation Approach
```json
// Enhanced linked_items structure
{
  "children": ["item-uuid-1", "item-uuid-2"],  // Items this item controls
  "parents": ["item-uuid-3"],                   // Items that control this item
  "bidirectional": ["item-uuid-4"]             // Legacy informational links
}
```

## Parent-Child Behavioral Logic

### Decision: Implement status propagation in item update service
**Rationale**:
- Single point of control for all item state changes
- Consistent behavior across all update paths (UI, API, offline sync)
- Leverages existing TanStack Query invalidation patterns
- Maintains real-time collaboration integrity

**Alternatives considered**:
- Client-side propagation: Rejected due to offline sync complexity and race conditions
- Database triggers: Rejected due to Supabase RLS complexity and debugging difficulty
- Separate microservice: Rejected as overkill for this feature scope

### Propagation Algorithm
```typescript
// When parent item moves to todo status
async function propagateToChildren(parentId: string) {
  const children = await getChildItems(parentId)
  const completedChildren = children.filter(child => child.is_completed)

  await Promise.all(
    completedChildren.map(child =>
      updateItem(child.id, { is_completed: false })
    )
  )
}
```

## Visual Differentiation Strategy

### Decision: Enhanced LinkIndicator component with directional arrows
**Rationale**:
- Leverages existing LinkIndicator component architecture
- Clear visual hierarchy with ⬇️ (parent) and ⬆️ (child) indicators
- Maintains accessibility standards with aria-labels
- Consistent with existing UI patterns

**Alternatives considered**:
- Color-coded indicators: Rejected due to accessibility concerns
- Text-based labels: Rejected due to mobile space constraints
- Separate parent/child components: Rejected due to code duplication

### Implementation Pattern
```tsx
// Parent indicator: 🔗⬇️ 3 (3 children)
// Child indicator: 🔗⬆️ 2 (2 parents)
// Mixed: 🔗⬇️2⬆️1 (2 children, 1 parent)
```

## Link Creation UX Flow

### Decision: Modal-based selection with parent-first workflow
**Rationale**:
- Clear establishment of parent-child hierarchy
- Reuses existing ItemLinker modal infrastructure
- Intuitive flow: select parent → choose children
- Prevents ambiguity about relationship direction

**Alternatives considered**:
- Drag-and-drop linking: Rejected due to mobile touch complexity
- Inline link type selection: Rejected due to UI clutter
- Bulk parent selection: Rejected due to relationship ambiguity

## Circular Dependency Prevention

### Decision: Graph traversal validation during link creation
**Rationale**:
- Prevents cycles at creation time rather than runtime
- Simple depth-first search for cycle detection
- Clear error messaging for users
- Maintains data integrity proactively

**Algorithm**:
```typescript
function wouldCreateCycle(parentId: string, childId: string): boolean {
  return canReach(childId, parentId, new Set())
}

function canReach(fromId: string, toId: string, visited: Set<string>): boolean {
  if (fromId === toId) return true
  if (visited.has(fromId)) return false

  visited.add(fromId)
  const children = getDirectChildren(fromId)
  return children.some(childId => canReach(childId, toId, visited))
}
```

## Migration Strategy

### Decision: Reset database for clean implementation
**Rationale**:
- Current development phase allows clean slate
- Avoids complex bidirectional→hierarchical conversion
- Prevents data inconsistencies during transition
- Enables proper testing of new schema

**Migration Steps**:
1. Reset Supabase database
2. Apply updated migrations with enhanced `linked_items` structure
3. Update linking service to use new schema
4. Update UI components for visual indicators
5. Implement status propagation logic

## Performance Considerations

### Decision: Maintain existing React.memo and query optimization patterns
**Rationale**:
- Current performance targets already met
- Parent-child propagation is infrequent operation
- Existing TanStack Query batching handles multiple updates
- Real-time sync already optimized for item updates

**Monitoring Points**:
- Status propagation latency (target: <100ms for 5-item chain)
- UI re-render frequency during bulk updates
- Offline sync queue size during propagation

## Testing Strategy

### Decision: Test-driven development with contract-first approach
**Rationale**:
- Establishes clear behavioral contracts
- Prevents regression in existing linking functionality
- Validates complex parent-child scenarios
- Ensures offline sync compatibility

**Test Priorities**:
1. Parent→child status propagation
2. Multiple parent scenarios
3. Circular dependency prevention
4. Visual indicator accuracy
5. Real-time collaboration during propagation

## Real-time Collaboration Impact

### Decision: Leverage existing real-time infrastructure with propagation awareness
**Rationale**:
- useRealtimeList already handles item updates
- Propagation creates multiple item updates that sync naturally
- No additional WebSocket messages needed
- Maintains conflict resolution patterns

**Considerations**:
- Multiple users triggering same parent concurrently
- Offline users receiving propagated updates
- Optimistic UI updates during propagation

## Bulk Operations Removal

### Decision: Disable bulk linking in ActionMenu and BulkLinker components
**Rationale**:
- Parent-child relationships require clear hierarchy
- Bulk operations create ambiguous relationship directions
- Simplifies UX and prevents user confusion
- Maintains bulk operations for other actions (delete, complete)

**Implementation**:
- Remove bulk linking from ActionMenu
- Add single-item parent selection mode to existing modals
- Update BulkLinker to handle only non-hierarchical operations

---

## Research Validation

✅ **All technical unknowns resolved**
✅ **Implementation approach validated against existing architecture**
✅ **Performance impact assessed and acceptable**
✅ **Migration strategy defined and safe**
✅ **Testing approach established**

**Ready for Phase 1: Design & Contracts**
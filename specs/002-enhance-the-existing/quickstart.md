# Quickstart: Behavioral Cross-List Linking System

## Overview
This quickstart validates the parent-child behavioral linking system that enables automatic status propagation for meal rotation workflows.

## Prerequisites
- Local Supabase instance running
- Database reset with enhanced linking migrations applied
- React development server running (`pnpm dev`)
- Test user authenticated

## Test Scenario 1: Basic Parent-Child Link Creation

### Setup
1. **Action**: Create a Simple List named "Meal Planning"
2. **Action**: Add item "Steak Dinner" to the list
3. **Action**: Create a Grocery List named "Shopping"
4. **Action**: Add items "Steak", "Potatoes", "Carrots" to grocery list

### Link Creation
1. **Action**: Click 🔗 button on "Steak Dinner" item
2. **Expected**: Modal opens showing current links (none)
3. **Action**: Click "Add New Link" or ➕ button
4. **Expected**: Parent-child link creation modal opens
5. **Action**: Select "Steak", "Potatoes", "Carrots" from dropdown/search
6. **Action**: Click "Create Links" button
7. **Expected**:
   - Modal closes
   - "Steak Dinner" shows 🔗⬇️3 indicator
   - "Steak" shows 🔗⬆️1 indicator
   - "Potatoes" shows 🔗⬆️1 indicator
   - "Carrots" shows 🔗⬆️1 indicator

## Test Scenario 2: Status Propagation (Core Functionality)

### Setup
1. **Action**: Mark "Steak Dinner" as completed
2. **Action**: Mark "Steak" and "Potatoes" as completed
3. **Action**: Leave "Carrots" in todo status
4. **Expected**:
   - "Steak Dinner": completed, 🔗⬇️3
   - "Steak": completed, 🔗⬆️1
   - "Potatoes": completed, 🔗⬆️1
   - "Carrots": todo, 🔗⬆️1

### Propagation Test
1. **Action**: Click checkbox on "Steak Dinner" to move back to todo
2. **Expected**:
   - "Steak Dinner": todo, 🔗⬇️3
   - "Steak": todo (automatically changed), 🔗⬆️1
   - "Potatoes": todo (automatically changed), 🔗⬆️1
   - "Carrots": todo (unchanged), 🔗⬆️1

### Independent Completion Test
1. **Action**: Mark "Steak" as completed
2. **Expected**:
   - "Steak Dinner": todo (unchanged)
   - "Steak": completed
   - Other items unchanged

## Test Scenario 3: Multiple Parents

### Setup
1. **Action**: Create new meal item "Beef Tacos" in Meal Planning list
2. **Action**: Link "Beef Tacos" to "Steak" (now "Steak" has 2 parents)
3. **Expected**: "Steak" shows 🔗⬆️2 indicator

### Multiple Parent Propagation
1. **Action**: Mark both "Steak Dinner" and "Beef Tacos" as completed
2. **Action**: Mark "Steak" as completed
3. **Action**: Move "Steak Dinner" to todo
4. **Expected**: "Steak" moves to todo
5. **Action**: Move "Beef Tacos" to todo
6. **Expected**: "Steak" remains in todo (no duplicate action)

## Test Scenario 4: Circular Dependency Prevention

### Validation Test
1. **Action**: Try to link "Steak" as parent of "Steak Dinner"
2. **Expected**: Error message "Cannot create circular dependency: Steak Dinner → Steak → Steak Dinner"
3. **Expected**: Link creation blocked, no changes made

### Self-Link Prevention
1. **Action**: Try to link "Steak Dinner" to itself
2. **Expected**: Error message "Item cannot be linked to itself"
3. **Expected**: Link creation blocked

## Test Scenario 5: Visual Indicators

### Mixed Relationship Item
1. **Action**: Create item "Ground Beef" in grocery list
2. **Action**: Link "Beef Tacos" → "Ground Beef" (Ground Beef is child)
3. **Action**: Link "Ground Beef" → "Onions" (Ground Beef is parent)
4. **Expected**: "Ground Beef" shows 🔗⬇️1⬆️1 indicator

### Link Count Accuracy
1. **Action**: Add more children to "Steak Dinner"
2. **Action**: Link to "Mushrooms" and "Wine"
3. **Expected**: "Steak Dinner" shows 🔗⬇️5 (Steak, Potatoes, Carrots, Mushrooms, Wine)

## Test Scenario 6: Link Management

### Remove Links
1. **Action**: Click 🔗 on "Steak Dinner" to view links
2. **Action**: Click remove/unlink button next to "Mushrooms"
3. **Expected**:
   - "Steak Dinner" shows 🔗⬇️4
   - "Mushrooms" shows no link indicator
   - Link relationship broken

### View Link Details
1. **Action**: Click 🔗 on any linked item
2. **Expected**: Modal shows:
   - Parents section (if any) with items that control this one
   - Children section (if any) with items this one controls
   - Clear visual distinction between parent and child relationships

## Test Scenario 7: Real-time Collaboration

### Multi-User Status Propagation
1. **Action**: Open second browser window/incognito (User B)
2. **Action**: User A moves parent to todo (triggers propagation)
3. **Expected**: User B sees child items update to todo in real-time
4. **Expected**: Real-time notifications show propagated changes

### Concurrent Link Creation
1. **Action**: User A starts creating link Parent→Child1
2. **Action**: User B creates link Parent→Child2 simultaneously
3. **Expected**: Both links created successfully
4. **Expected**: Parent shows correct child count

## Test Scenario 8: Offline Sync

### Offline Status Propagation
1. **Action**: Disconnect internet
2. **Action**: Move parent item to todo (should trigger propagation)
3. **Expected**: Parent and children updated locally
4. **Action**: Reconnect internet
5. **Expected**: All changes sync to server
6. **Expected**: Other users receive propagated updates

## Test Scenario 9: Mobile Touch Interface

### Touch-Friendly Link Creation
1. **Action**: Switch to mobile view (or use actual mobile device)
2. **Action**: Tap ⋯ menu on item
3. **Expected**: Action menu opens with link options
4. **Action**: Select "Manage links" from menu
5. **Expected**: Modal appropriate for mobile screen size

### Visual Indicator Clarity
1. **Expected**: Parent/child indicators clearly visible on mobile
2. **Expected**: Touch targets adequate size (44px minimum)
3. **Expected**: No overlap with other UI elements

## Performance Validation

### Status Propagation Latency
1. **Measure**: Time from parent status change to child updates complete
2. **Target**: <100ms for chains up to 5 items
3. **Test**: Parent with 10 children, measure propagation time

### UI Responsiveness
1. **Test**: Link indicator updates during rapid status changes
2. **Target**: No visual lag or flickering
3. **Test**: Real-time updates don't block UI interactions

## Error Scenarios

### Invalid Link Attempts
1. **Test**: Link to non-existent item ID
2. **Expected**: Clear error message, no partial state changes

### Orphaned Link Cleanup
1. **Action**: Delete item that has parent/child relationships
2. **Expected**: All references removed from linked items
3. **Expected**: Link indicators update correctly

### Permission Boundaries
1. **Test**: Try to link items from lists user doesn't have edit access to
2. **Expected**: Appropriate permission error message

---

## Success Criteria

✅ **Parent-child links create successfully**
✅ **Status propagation works automatically**
✅ **Multiple parents supported correctly**
✅ **Circular dependencies prevented**
✅ **Visual indicators accurate and clear**
✅ **Link management UI functional**
✅ **Real-time collaboration maintains consistency**
✅ **Offline sync handles propagation**
✅ **Mobile interface usable**
✅ **Performance targets met**
✅ **Error handling graceful**

## Validation Checklist

- [ ] All test scenarios executed successfully
- [ ] No regressions in existing linking functionality
- [ ] Performance targets achieved
- [ ] Mobile experience validated
- [ ] Error messages clear and helpful
- [ ] Real-time sync working correctly
- [ ] Offline functionality preserved

**Status**: Ready for implementation when all checkboxes complete
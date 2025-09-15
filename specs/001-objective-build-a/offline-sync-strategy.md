# Offline Sync & Conflict Resolution Strategy

## Conflict Resolution Approach

**Decision**: Last-Write-Wins with Optimistic Locking using updated_at timestamps
**Rationale**: Simple to implement, prevents most conflicts, graceful degradation for edge cases

### Conflict Detection
```typescript
interface ConflictDetection {
  clientTimestamp: string; // When client last synced
  serverTimestamp: string; // Current server timestamp
  hasConflict: boolean;    // Server version newer than client's last sync
}

// Example conflict check
const hasConflict = (clientLastSync: string, serverUpdatedAt: string) => {
  return new Date(serverUpdatedAt) > new Date(clientLastSync);
};
```

### Resolution Strategy by Entity

**Lists**:
- **Conflict**: Server version wins, client changes lost
- **Resolution**: Show user notification about lost changes
- **Rationale**: List metadata conflicts are rare, not worth complex merge logic

**Items**:
- **Conflict**: Last-write-wins by updated_at timestamp
- **Special Case**: Completion status conflicts use OR logic (if either says completed, item is completed)
- **Rationale**: Completion conflicts are common in shared grocery lists

**Share Management**:
- **Conflict**: Server always wins (owner has authority)
- **Resolution**: Refresh permissions immediately
- **Rationale**: Security-critical, no client override allowed

### Implementation Pattern
```typescript
// TanStack Query mutation with conflict handling
const updateItemMutation = useMutation({
  mutationFn: async (item: Item) => {
    const response = await supabase
      .from('items')
      .update(item)
      .eq('id', item.id)
      .eq('updated_at', item.updated_at) // Optimistic lock
      .select();

    if (response.data?.length === 0) {
      throw new ConflictError('Item was modified by another user');
    }
    return response.data[0];
  },
  onError: (error) => {
    if (error instanceof ConflictError) {
      // Refetch latest data and show conflict resolution UI
      queryClient.invalidateQueries(['items', item.list_id]);
      showConflictNotification();
    }
  }
});
```

## Offline Queue Management

**Queue Storage**: IndexedDB with Dexie.js for offline mutations
**Queue Processing**: Background sync when connectivity returns

```typescript
interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'list' | 'item' | 'share';
  data: any;
  timestamp: string;
  retryCount: number;
}

// Queue processing order
const processOfflineQueue = async () => {
  const actions = await offlineQueue.orderBy('timestamp').toArray();

  for (const action of actions) {
    try {
      await executeAction(action);
      await offlineQueue.delete(action.id);
    } catch (error) {
      if (isConflictError(error)) {
        // Handle conflict, possibly skip this action
        await offlineQueue.delete(action.id);
        logConflictResolution(action, 'skipped');
      } else {
        // Retry later
        action.retryCount++;
        await offlineQueue.put(action);
      }
    }
  }
};
```

## Network State Management

**Detection**: Navigator.onLine + periodic connectivity checks
**Sync Trigger**: Automatic on reconnection + manual refresh option

```typescript
const useNetworkState = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue(); // Trigger sync
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
};
```
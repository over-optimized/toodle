# Push Notification Strategy

## 🚨 COST ALERT: Notification Service Selection

### Recommended Approach (FREE TIER COMPLIANT)

**Decision**: Web Push API with Supabase Edge Functions (FREE within limits)
**Rationale**:
- Web Push API is browser-native (no external service cost)
- Supabase Edge Functions handle push logic (free tier: 500,000 invocations/month)
- No dependency on paid services like FCM Premium or OneSignal Pro

### Free Tier Limits
- **Supabase Edge Functions**: 500,000 invocations/month (more than sufficient)
- **Web Push API**: Browser-native, no cost
- **Supabase Database**: 500MB storage, 2GB bandwidth (adequate for notifications)

### Alternative (PAID SERVICE WARNING)
- **Firebase Cloud Messaging**: Free tier exists but limited, premium features cost money
- **OneSignal**: Free tier limited to 10,000 subscribers
- **Pusher**: 200 connections free, then paid

## Notification Flow

### 1. Permission Request
```typescript
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    await subscribeToNotifications();
  }
  return permission;
};
```

### 2. Service Worker Registration
```typescript
// Register service worker for notifications
const registerNotificationWorker = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
    });

    // Store subscription in database
    await supabase.from('user_subscriptions').upsert({
      user_id: user.id,
      subscription: JSON.stringify(subscription),
      updated_at: new Date().toISOString()
    });

    return subscription;
  }
};
```

### 3. Countdown Notification Scheduling
```typescript
// Supabase Edge Function to check and send notifications
const checkCountdownNotifications = async () => {
  const { data: expiredItems } = await supabase
    .from('items')
    .select(`
      *,
      lists!inner(user_id)
    `)
    .lte('target_date', new Date().toISOString())
    .eq('is_completed', false)
    .is('notification_sent_at', null);

  for (const item of expiredItems) {
    await sendNotification(item);

    // Mark as notified
    await supabase
      .from('items')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', item.id);
  }
};

// Send via Web Push API
const sendNotification = async (item: any) => {
  const { data: subscriptions } = await supabase
    .from('user_subscriptions')
    .select('subscription')
    .eq('user_id', item.lists.user_id);

  for (const sub of subscriptions) {
    await webpush.sendNotification(
      JSON.parse(sub.subscription),
      JSON.stringify({
        title: 'Countdown Expired',
        body: `"${item.content}" deadline has passed`,
        data: {
          listId: item.list_id,
          itemId: item.id,
          url: `/lists/${item.list_id}`
        }
      })
    );
  }
};
```

### 4. Cron Job Scheduling (FREE)
```sql
-- Supabase pg_cron extension (free)
SELECT cron.schedule(
  'check-countdown-notifications',
  '*/5 * * * *', -- Every 5 minutes
  'SELECT net.http_post(
    url := ''https://your-project.supabase.co/functions/v1/check-notifications'',
    headers := ''{"Authorization": "Bearer ' || service_role_key || '"}'',
    body := ''{}''
  );'
);
```

## Notification Types

### Countdown Expiration
- **Trigger**: target_date <= NOW() AND notification_sent_at IS NULL
- **Content**: "Countdown expired: [item.content]"
- **Action**: Open specific list

### Optional Future Notifications (Within Free Limits)
- **Share Invitations**: When someone shares a list
- **Collaboration Updates**: When shared list items are modified
- **Daily Digest**: Summary of upcoming countdowns

## Database Schema Addition

```sql
-- Add notification tracking to items
ALTER TABLE items ADD COLUMN notification_sent_at TIMESTAMP WITH TIME ZONE;

-- Store user push subscriptions
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

## Privacy & Settings

### User Control
```typescript
interface NotificationSettings {
  countdownExpired: boolean;
  shareInvitations: boolean;
  collaborationUpdates: boolean;
  dailyDigest: boolean;
}

// Store in user preferences
const updateNotificationSettings = (settings: NotificationSettings) => {
  return supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      notification_settings: settings
    });
};
```

### Privacy Compliance
- Users must explicitly opt-in to notifications
- Clear unsubscribe mechanism
- No personal data in notification payloads
- Subscription cleanup on account deletion

## Implementation Priority
1. **Phase 1**: Basic countdown notifications (MVP requirement)
2. **Phase 2**: Share invitation notifications
3. **Phase 3**: Collaboration and digest notifications (if user adoption warrants)
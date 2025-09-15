# PWA Update Mechanism

## Update Strategy (FREE TIER COMPLIANT)

**Decision**: Vite PWA Plugin with Workbox for update management
**Rationale**:
- Built into Vite PWA plugin (no additional cost)
- Workbox provides proven update patterns
- No dependency on paid update services
- User-controlled update timing

## Update Detection & Prompting

### Service Worker Update Detection
```typescript
// src/hooks/useUpdatePrompt.ts
import { useRegisterSW } from 'virtual:pwa-register/react';

const useUpdatePrompt = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(swRegistration) {
      console.log('SW Registered:', swRegistration);
    },
    onRegisterError(error) {
      console.log('SW registration error:', error);
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
    onNeedRefresh() {
      console.log('New version available');
    },
  });

  const updateApp = () => {
    updateServiceWorker(true);
  };

  const dismissUpdate = () => {
    setNeedRefresh(false);
  };

  return {
    offlineReady,
    needRefresh,
    updateApp,
    dismissUpdate,
  };
};
```

### Update Prompt Component
```typescript
// src/components/UpdatePrompt.tsx
import { useUpdatePrompt } from '@/hooks/useUpdatePrompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const UpdatePrompt = () => {
  const { needRefresh, updateApp, dismissUpdate } = useUpdatePrompt();

  if (!needRefresh) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">App Update Available</CardTitle>
        <CardDescription className="text-xs">
          A new version of the app is ready to install.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2 pt-0">
        <Button
          size="sm"
          onClick={updateApp}
          className="flex-1"
        >
          Update Now
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={dismissUpdate}
          className="flex-1"
        >
          Later
        </Button>
      </CardContent>
    </Card>
  );
};

export default UpdatePrompt;
```

## Workbox Configuration

### Vite PWA Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                // Remove auth headers from cache key for security
                const url = new URL(request.url);
                return url.href;
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable for development testing
      },
      manifest: {
        name: 'Toodle - List Manager',
        short_name: 'Toodle',
        description: 'Mobile-first PWA for managing lists',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
```

## Update Strategies by Environment

### Development
- **Auto-reload**: Immediate updates for development speed
- **No prompting**: Updates apply automatically
- **Cache bypass**: Fresh content every time

### Staging
- **Prompt for updates**: Test update flow
- **Cache validation**: Ensure caching works correctly
- **Update testing**: Validate update process

### Production
- **User-controlled updates**: Never force updates during active use
- **Graceful prompting**: Non-intrusive update notifications
- **Rollback capability**: Ability to revert if issues occur

## Cache Management

### Cache Invalidation Strategy
```typescript
// src/utils/cacheManager.ts
const clearAppCache = async () => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames.map(async (cacheName) => {
        if (cacheName.includes('workbox') || cacheName.includes('supabase-api')) {
          console.log('Clearing cache:', cacheName);
          await caches.delete(cacheName);
        }
      })
    );
  }
};

const refreshAppData = async () => {
  // Clear TanStack Query cache
  queryClient.clear();

  // Clear IndexedDB offline data (if needed for major updates)
  // await offlineStorage.clear();

  // Trigger fresh data fetch
  await queryClient.refetchQueries();
};
```

### Version-Based Cache Busting
```typescript
// Add version to API requests for cache busting
const API_VERSION = 'v1.0.0'; // Updated with each release

const supabaseWithVersion = supabase.from('lists').select('*', {
  headers: {
    'X-App-Version': API_VERSION,
  },
});

// Service worker can use version for cache decisions
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const appVersion = event.request.headers.get('X-App-Version');

  // If version mismatch, bypass cache
  if (appVersion && appVersion !== CURRENT_VERSION) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Normal cache handling
});
```

## Update Rollback Strategy

### Rollback Detection
```typescript
// Monitor for critical errors after update
const monitorUpdateHealth = () => {
  const errorCount = useRef(0);
  const updateTimestamp = localStorage.getItem('lastUpdateTime');

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      errorCount.current++;

      // If too many errors shortly after update, suggest rollback
      if (updateTimestamp && errorCount.current > 5) {
        const timeSinceUpdate = Date.now() - parseInt(updateTimestamp);
        if (timeSinceUpdate < 5 * 60 * 1000) { // 5 minutes
          showRollbackOption();
        }
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [updateTimestamp]);
};

const showRollbackOption = () => {
  // Show user option to clear cache and reload
  toast({
    title: 'App Issues Detected',
    description: 'Would you like to refresh the app?',
    action: (
      <Button onClick={handleRollback} size="sm">
        Refresh App
      </Button>
    ),
  });
};

const handleRollback = async () => {
  await clearAppCache();
  localStorage.removeItem('lastUpdateTime');
  window.location.reload();
};
```

## Update Notification Strategy

### User Experience
```typescript
// Smart update timing - avoid interrupting active use
const useSmartUpdatePrompt = () => {
  const { needRefresh } = useUpdatePrompt();
  const [isUserActive, setIsUserActive] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      setIsUserActive(true);
      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(() => {
        setIsUserActive(false);

        // Show update prompt when user is inactive
        if (needRefresh) {
          setShowPrompt(true);
        }
      }, 30000); // 30 seconds of inactivity
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [needRefresh]);

  return { showPrompt, setShowPrompt };
};
```

### Progressive Enhancement
```typescript
// Graceful degradation for browsers without PWA support
const UpdateManager = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check if PWA features are available
    if ('serviceWorker' in navigator) {
      // Use service worker updates
      return <UpdatePrompt />;
    } else {
      // Fallback to manual refresh prompting
      return <ManualRefreshPrompt />;
    }
  }, []);
};

const ManualRefreshPrompt = () => {
  // Simple refresh button for non-PWA browsers
  return (
    <Button onClick={() => window.location.reload()}>
      Refresh for Latest Version
    </Button>
  );
};
```

## Deployment Integration

### Vercel Integration
```typescript
// vercel.json - cache headers for optimal PWA updates
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    },
    {
      "source": "/workbox-*.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### Build Process
```bash
# Build script with update tracking
npm run build

# Generate version info
echo "$(date -u +%Y%m%d%H%M%S)" > dist/version.txt
echo "$(git rev-parse --short HEAD)" >> dist/version.txt

# Deploy with version metadata
vercel deploy --prod
```
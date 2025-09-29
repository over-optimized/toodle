# Error Boundary & Resilience Strategy

## Error Boundary Architecture (FREE TIER COMPLIANT)

**Decision**: Functional Error Boundaries with react-error-boundary + Custom Error Reporting to Supabase
**Rationale**:
- react-error-boundary provides functional component approach
- Supabase logging within free tier limits
- Modern React patterns with hooks
- Better TypeScript integration

### 🚨 COST ALERTS for Alternative Services
- **Sentry**: $26/month for team plan (free tier very limited)
- **Bugsnag**: $59/month for startup plan
- **LogRocket**: $99/month for team plan
- **Rollbar**: $15/month for starter plan

## Functional Error Boundary Implementation

### Installation & Setup
```bash
npm install react-error-boundary
```

### Global Error Boundary with Hook
```typescript
// src/components/AppErrorBoundary.tsx
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We're sorry, but something unexpected happened. Our team has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <details className="rounded border p-2 text-sm">
              <summary className="cursor-pointer font-medium">Technical Details</summary>
              <pre className="mt-2 overflow-auto text-xs">
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button onClick={resetErrorBoundary} variant="outline" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={handleGoHome} variant="outline" className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Button onClick={handleReload} className="flex-1">
              Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

export const AppErrorBoundary = ({ children }: AppErrorBoundaryProps) => {
  const { logError } = useErrorHandler();

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logError}
      onReset={() => {
        // Clear any corrupt state
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

### Custom Error Handler Hook
```typescript
// src/hooks/useErrorHandler.ts
import { useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

export const useErrorHandler = () => {
  const logError = useCallback(async (error: Error, errorInfo?: { componentStack: string }) => {
    const errorId = Math.random().toString(36).substring(7);

    console.error('Error logged:', error, errorInfo);

    try {
      await supabase.from('error_logs').insert({
        error_id: errorId,
        message: error.message,
        stack: error.stack,
        component_stack: errorInfo?.componentStack,
        user_agent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return errorId;
  }, []);

  const handleError = useCallback((error: unknown, context?: string) => {
    console.error(`Error in ${context}:`, error);

    // Network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      if (!navigator.onLine) {
        toast({
          title: 'Offline',
          description: 'Changes will sync when you\'re back online.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Connection Error',
          description: 'Please check your internet connection.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Supabase auth errors
    if (error instanceof Error && error.message.includes('auth')) {
      toast({
        title: 'Authentication Error',
        description: 'Please sign in again.',
        variant: 'destructive',
      });
      window.location.href = '/auth';
      return;
    }

    // Generic error
    toast({
      title: 'Something went wrong',
      description: 'Please try again or refresh the page.',
      variant: 'destructive',
    });

    // Log error for debugging
    if (error instanceof Error) {
      logError(error);
    }
  }, [logError]);

  return { handleError, logError };
};
```

### Route-Level Error Boundary (Functional)
```typescript
// src/components/RouteErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, RefreshCw } from 'lucide-react';

const RouteErrorFallback = () => {
  const error = useRouteError();

  let errorMessage: string;
  let errorStatus: number | undefined;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || 'An error occurred';
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = 'An unexpected error occurred';
  }

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {errorStatus ? `Error ${errorStatus}` : 'Navigation Error'}
          </CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={handleGoHome} variant="outline" className="flex-1">
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
          <Button onClick={handleReload} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export const RouteErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
      {children}
    </ErrorBoundary>
  );
};
```

### Async Error Boundary Hook
```typescript
// src/hooks/useAsyncError.ts
import { useCallback, useState } from 'react';

export const useAsyncError = () => {
  const [, setError] = useState();

  return useCallback(
    (error: Error) => {
      setError(() => {
        throw error;
      });
    },
    [setError]
  );
};

// Usage in async operations
const SomeComponent = () => {
  const throwAsyncError = useAsyncError();

  const handleAsyncOperation = async () => {
    try {
      await someAsyncOperation();
    } catch (error) {
      throwAsyncError(error as Error);
    }
  };

  return <Button onClick={handleAsyncOperation}>Do Something</Button>;
};
```

### Component-Level Error Boundaries
```typescript
// src/components/ListErrorBoundary.tsx
import { ErrorBoundary } from 'react-error-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ListErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ListErrorFallback = ({ error, resetErrorBoundary }: ListErrorFallbackProps) => (
  <Alert variant="destructive" className="m-4">
    <AlertDescription className="flex items-center justify-between">
      <span>Failed to load list: {error.message}</span>
      <Button
        onClick={resetErrorBoundary}
        variant="outline"
        size="sm"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </AlertDescription>
  </Alert>
);

export const ListErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      FallbackComponent={ListErrorFallback}
      onReset={() => {
        // Clear list-specific cache
        queryClient.invalidateQueries(['lists']);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

### App Setup with Error Boundaries
```typescript
// src/App.tsx
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (error instanceof Error && error.message.includes('auth')) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RouteErrorBoundary>
            <Routes>
              {/* Your routes */}
            </Routes>
          </RouteErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
```

### Network Error Handling with Hooks
```typescript
// src/hooks/useNetworkError.ts
import { useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useErrorHandler } from './useErrorHandler';

export const useNetworkError = () => {
  const { handleError } = useErrorHandler();

  const handleNetworkError = useCallback((error: unknown) => {
    if (!navigator.onLine) {
      toast({
        title: 'Offline',
        description: 'You\'re currently offline. Changes will sync when connected.',
        variant: 'default',
      });
      return;
    }

    handleError(error, 'network operation');
  }, [handleError]);

  return { handleNetworkError };
};

// Usage in TanStack Query
const useCreateList = () => {
  const { handleNetworkError } = useNetworkError();

  return useMutation({
    mutationFn: createList,
    onError: handleNetworkError,
  });
};
```

### Recovery Hook
```typescript
// src/hooks/useRecovery.ts
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

export const useRecovery = () => {
  const queryClient = useQueryClient();

  const recoverFromError = useCallback(async () => {
    try {
      // Clear corrupted cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Reset query cache
      queryClient.clear();

      // Trigger fresh data fetch
      await queryClient.refetchQueries();

      toast({
        title: 'Recovery Complete',
        description: 'App data has been refreshed.',
      });
    } catch (error) {
      console.error('Recovery failed:', error);
      window.location.reload();
    }
  }, [queryClient]);

  return { recoverFromError };
};
```

### Progressive Enhancement with Hooks
```typescript
// src/hooks/useFeatureSupport.ts
import { useMemo } from 'react';

export const useFeatureSupport = () => {
  return useMemo(() => ({
    serviceWorker: 'serviceWorker' in navigator,
    indexedDB: 'indexedDB' in window,
    notifications: 'Notification' in window,
    webShare: 'share' in navigator,
    clipboard: 'clipboard' in navigator,
  }), []);
};

// Usage component
const ShareButton = ({ listId }: { listId: string }) => {
  const { webShare, clipboard } = useFeatureSupport();

  const handleShare = async () => {
    const url = `${window.location.origin}/lists/${listId}`;

    if (webShare) {
      try {
        await navigator.share({ url });
      } catch (error) {
        // Fallback to clipboard
        if (clipboard) {
          await navigator.clipboard.writeText(url);
          toast({ title: 'Link copied to clipboard' });
        }
      }
    } else if (clipboard) {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied to clipboard' });
    }
  };

  if (!webShare && !clipboard) {
    return null; // Hide if no share capabilities
  }

  return (
    <Button onClick={handleShare}>
      Share List
    </Button>
  );
};
```

This functional approach provides:
- Modern React patterns with hooks
- Better TypeScript integration
- Easier testing
- More modular error handling
- Cleaner component composition
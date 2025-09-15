# Security & Rate Limiting Strategy

## Rate Limiting Implementation (FREE TIER COMPLIANT)

### Supabase Built-in Rate Limiting (FREE)
**Decision**: Use Supabase's built-in rate limiting + PostgreSQL-based additional limits
**Rationale**:
- Supabase provides basic rate limiting for free
- PostgreSQL can enforce business logic limits
- No dependency on external paid rate limiting services

### 🚨 COST ALERTS for Alternative Services
- **Cloudflare Rate Limiting**: $20/month for advanced rules
- **Auth0**: $23/month for production features
- **AWS API Gateway**: Pay per request (can get expensive)
- **Redis Cloud**: $5/month minimum for rate limiting

## Rate Limiting Rules

### 1. Authentication Endpoints
```sql
-- Rate limit magic link requests (prevent email spam)
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- email or IP address
  action TEXT NOT NULL,     -- 'magic_link', 'share_create', etc.
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_limit INTEGER,
  p_window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Clean old entries
  DELETE FROM rate_limits
  WHERE action = p_action
  AND window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Get current count
  SELECT COALESCE(SUM(count), 0) INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier
  AND action = p_action
  AND window_start >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Check if limit exceeded
  IF current_count >= p_limit THEN
    RETURN FALSE;
  END IF;

  -- Record this request
  INSERT INTO rate_limits (identifier, action, count)
  VALUES (p_identifier, p_action, 1)
  ON CONFLICT (identifier, action)
  DO UPDATE SET count = rate_limits.count + 1;

  RETURN TRUE;
END;
$$ LANGUAGE 'plpgsql';
```

### 2. Rate Limit Configuration
```typescript
// Rate limiting rules
const RATE_LIMITS = {
  MAGIC_LINK: { limit: 3, windowMinutes: 15 }, // 3 requests per 15 minutes
  SHARE_CREATE: { limit: 10, windowMinutes: 60 }, // 10 shares per hour
  LIST_CREATE: { limit: 20, windowMinutes: 60 }, // 20 lists per hour (more than daily limit)
  ITEM_CREATE: { limit: 200, windowMinutes: 60 }, // 200 items per hour
} as const;

// Middleware for API calls
const checkRateLimit = async (identifier: string, action: keyof typeof RATE_LIMITS) => {
  const rule = RATE_LIMITS[action];

  const { data } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_action: action.toLowerCase(),
    p_limit: rule.limit,
    p_window_minutes: rule.windowMinutes
  });

  if (!data) {
    throw new Error(`Rate limit exceeded for ${action}. Try again later.`);
  }
};
```

### 3. Share Security Enhancements
```sql
-- Add audit trail for share access
CREATE TABLE share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  accessed_by_ip INET,
  accessed_by_user_agent TEXT,
  access_granted BOOLEAN NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to validate and log share access
CREATE OR REPLACE FUNCTION validate_share_access(
  p_share_id UUID,
  p_ip INET,
  p_user_agent TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  share_record RECORD;
  access_count INTEGER;
BEGIN
  -- Get share details
  SELECT * INTO share_record
  FROM shares
  WHERE id = p_share_id
  AND expires_at > NOW();

  -- Share not found or expired
  IF NOT FOUND THEN
    INSERT INTO share_access_log (share_id, accessed_by_ip, accessed_by_user_agent, access_granted)
    VALUES (p_share_id, p_ip, p_user_agent, FALSE);
    RETURN FALSE;
  END IF;

  -- Check for abuse (same IP accessing too frequently)
  SELECT COUNT(*) INTO access_count
  FROM share_access_log
  WHERE share_id = p_share_id
  AND accessed_by_ip = p_ip
  AND accessed_at > NOW() - INTERVAL '1 hour';

  -- Rate limit share access per IP
  IF access_count >= 100 THEN
    INSERT INTO share_access_log (share_id, accessed_by_ip, accessed_by_user_agent, access_granted)
    VALUES (p_share_id, p_ip, p_user_agent, FALSE);
    RETURN FALSE;
  END IF;

  -- Log successful access
  INSERT INTO share_access_log (share_id, accessed_by_ip, accessed_by_user_agent, access_granted)
  VALUES (p_share_id, p_ip, p_user_agent, TRUE);

  RETURN TRUE;
END;
$$ LANGUAGE 'plpgsql';
```

## Security Headers & CORS

### Content Security Policy
```typescript
// Vite CSP configuration
const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-eval'"], // Needed for Vite dev
  'style-src': ["'self'", "'unsafe-inline'"], // Needed for Tailwind
  'img-src': ["'self'", "data:", "https:"],
  'connect-src': ["'self'", "wss://*.supabase.co", "https://*.supabase.co"],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
};
```

### CORS Configuration
```typescript
// Supabase CORS settings (configured in dashboard)
const corsConfig = {
  allowedOrigins: [
    'http://localhost:5173', // Development
    'https://your-app.vercel.app', // Production
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'apikey'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
```

## Data Validation & Sanitization

### Input Validation
```typescript
// Zod schemas for API validation
const CreateListSchema = z.object({
  type: z.enum(['simple', 'grocery', 'countdown']),
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title too long')
    .regex(/^[^<>'"&]*$/, 'Invalid characters in title'), // Basic XSS prevention
});

const CreateItemSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(500, 'Content too long')
    .regex(/^[^<>'"&]*$/, 'Invalid characters in content'),
  target_date: z.string().datetime().optional(),
  sort_order: z.number().int().min(0),
});

const ShareListSchema = z.object({
  shared_with_email: z.string().email('Invalid email format'),
  role: z.enum(['read', 'edit']),
});
```

### SQL Injection Prevention
```typescript
// Always use parameterized queries with Supabase
const getSafeList = async (listId: string, userId: string) => {
  // SAFE - parameterized
  return supabase
    .from('lists')
    .select('*')
    .eq('id', listId)
    .eq('user_id', userId);

  // NEVER do this - vulnerable to injection
  // return supabase.rpc('unsafe_query', {
  //   query: `SELECT * FROM lists WHERE id = '${listId}'`
  // });
};
```

## Monitoring & Alerting (FREE)

### Database Monitoring
```sql
-- Monitor suspicious activity
CREATE VIEW security_alerts AS
SELECT
  'High share access rate' as alert_type,
  s.list_id,
  s.shared_with_email,
  COUNT(*) as access_count,
  MAX(sal.accessed_at) as last_access
FROM shares s
JOIN share_access_log sal ON s.id = sal.share_id
WHERE sal.accessed_at > NOW() - INTERVAL '1 hour'
GROUP BY s.list_id, s.shared_with_email
HAVING COUNT(*) > 50

UNION ALL

SELECT
  'Rate limit violations' as alert_type,
  NULL as list_id,
  rl.identifier as email,
  SUM(rl.count) as violation_count,
  MAX(rl.created_at) as last_violation
FROM rate_limits rl
WHERE rl.created_at > NOW() - INTERVAL '1 hour'
GROUP BY rl.identifier, rl.action
HAVING SUM(rl.count) > 20;
```

### Application-Level Monitoring
```typescript
// Error tracking (free tier available)
const logSecurityEvent = async (event: {
  type: 'rate_limit' | 'invalid_access' | 'suspicious_activity';
  userId?: string;
  ip?: string;
  details: Record<string, any>;
}) => {
  // Log to Supabase for analysis
  await supabase.from('security_events').insert({
    event_type: event.type,
    user_id: event.userId,
    ip_address: event.ip,
    details: event.details,
    created_at: new Date().toISOString(),
  });

  // For production, could also send to free tier of services like:
  // - Sentry (free tier available)
  // - LogRocket (free tier available)
  console.error(`Security Event: ${event.type}`, event.details);
};
```

## Cleanup Jobs

### Automated Cleanup (FREE with pg_cron)
```sql
-- Clean old rate limit entries (daily)
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 2 * * *', -- 2 AM daily
  'DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL ''7 days'';'
);

-- Clean old share access logs (weekly)
SELECT cron.schedule(
  'cleanup-share-logs',
  '0 3 * * 0', -- 3 AM Sunday
  'DELETE FROM share_access_log WHERE accessed_at < NOW() - INTERVAL ''30 days'';'
);

-- Clean expired shares (daily)
SELECT cron.schedule(
  'cleanup-expired-shares',
  '0 1 * * *', -- 1 AM daily
  'DELETE FROM shares WHERE expires_at < NOW();'
);
```
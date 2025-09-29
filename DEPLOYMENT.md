# Deployment Guide - Toodle PWA

This guide covers deploying Toodle to various platforms with focus on Vercel (recommended).

## 🚀 Vercel Deployment (Recommended)

### Quick Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/toodle)

### Manual Setup

#### 1. Prerequisites
- Vercel account
- GitHub repository
- Supabase project configured

#### 2. Project Configuration
```bash
# In your project root
npm i -g vercel
vercel login
```

#### 3. Environment Variables
Configure in Vercel dashboard or via CLI:

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

**Required Environment Variables:**
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

#### 4. Build Configuration
Vercel auto-detects Vite projects. Custom configuration in `vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "vite",
  "functions": {
    "app/api/**/*.js": {
      "runtime": "nodejs18.x"
    }
  },
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
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
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

#### 5. Deploy
```bash
vercel --prod
```

### Performance Optimization for Vercel

#### Edge Runtime
Add to critical pages for faster response:
```typescript
export const config = {
  runtime: 'edge'
}
```

#### ISR (Incremental Static Regeneration)
For static content that updates periodically:
```typescript
export async function getStaticProps() {
  return {
    props: {},
    revalidate: 3600 // 1 hour
  }
}
```

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # PWA Configuration
        location /sw.js {
            add_header Cache-Control "public, max-age=0, must-revalidate";
        }

        location /manifest.json {
            add_header Cache-Control "public, max-age=31536000, immutable";
        }

        # SPA Fallback
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Security Headers
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

### Build and Run
```bash
docker build -t toodle .
docker run -p 80:80 toodle
```

## ☁️ Netlify Deployment

### netlify.toml
```toml
[build]
  publish = "dist"
  command = "pnpm build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

### Deploy
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## 🌊 Digital Ocean App Platform

### .do/app.yaml
```yaml
name: toodle
services:
- name: web
  source_dir: /
  github:
    repo: your-username/toodle
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  build_command: pnpm build
  envs:
  - key: VITE_SUPABASE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${VITE_SUPABASE_URL}
  - key: VITE_SUPABASE_ANON_KEY
    scope: RUN_AND_BUILD_TIME
    value: ${VITE_SUPABASE_ANON_KEY}
  routes:
  - path: /
```

## 🔧 Post-Deployment Checklist

### 1. Verify PWA Features
- [ ] Service worker registration
- [ ] Offline functionality
- [ ] Install prompt appears
- [ ] App manifest loads correctly

### 2. Test Core Features
- [ ] User authentication works
- [ ] Lists can be created/edited/deleted
- [ ] Real-time updates function
- [ ] Sharing links work
- [ ] Offline sync operates correctly

### 3. Performance Validation
- [ ] Initial load time <2s
- [ ] Interaction response <200ms
- [ ] Bundle size within targets
- [ ] Lighthouse PWA score >90

### 4. Security Verification
- [ ] HTTPS enabled
- [ ] Security headers present
- [ ] Environment variables secure
- [ ] No sensitive data in client bundle

### 5. Database Health
- [ ] Supabase connection working
- [ ] RLS policies active
- [ ] Database migrations applied
- [ ] Backup strategy in place

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

#### Environment Variables Not Loading
- Verify variable names match exactly
- Check for typos in `.env` files
- Ensure variables are prefixed with `VITE_`
- Restart development server after changes

#### PWA Not Installing
- Check service worker registration
- Verify manifest.json is accessible
- Ensure HTTPS is enabled in production
- Check browser developer tools for PWA criteria

#### Real-time Features Not Working
- Verify Supabase Realtime is enabled
- Check WebSocket connection in network tab
- Validate RLS policies allow real-time subscriptions
- Test with multiple browser tabs

### Performance Issues
```bash
# Analyze bundle size
pnpm analyze

# Check for large dependencies
npx webpack-bundle-analyzer dist/stats.json

# Lighthouse audit
npx lighthouse https://your-app-url --view
```

### Debugging Tools
- **Vercel**: Use `vercel logs` for deployment logs
- **Browser DevTools**: Check Network, Performance, and Application tabs
- **Supabase**: Monitor dashboard for database performance
- **Bundle Analyzer**: Use generated `dist/stats.html`

## 📊 Monitoring in Production

### Performance Monitoring
- Set up Vercel Analytics
- Monitor Core Web Vitals
- Track bundle size changes
- Use Lighthouse CI for automated audits

### Error Tracking
- Implement error boundaries
- Log critical errors to external service
- Monitor Supabase error rates
- Set up alerts for deployment failures

### User Analytics
- Track PWA installation rates
- Monitor feature usage
- Analyze performance metrics
- User feedback collection

---

**Need help?** Create an issue in the repository or check the troubleshooting section above.
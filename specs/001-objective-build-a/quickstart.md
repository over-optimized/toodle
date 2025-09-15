# Quickstart: Mobile-First PWA List Management

## Prerequisites
- Node.js 18+ installed
- Supabase account created
- Email service configured (for magic links)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 1. Environment Setup

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create new project
2. Note down your project URL and anon key
3. Enable Email Auth in Authentication settings
4. Configure email templates for magic links

### Clone and Configure
```bash
# Clone repository
git clone <repository-url>
cd toodle

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
```

## 2. Database Setup

### Run Database Migrations
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push database schema
supabase db push
```

### Verify Database Schema
1. Check tables exist: users, lists, items, shares, item_history
2. Verify RLS policies are active
3. Test authentication flow

## 3. Development Server

### Start Application
```bash
# Development mode
npm run dev

# Application available at http://localhost:5173
```

### Verify PWA Setup
1. Open browser developer tools
2. Check Application > Service Workers
3. Verify manifest.json loads correctly
4. Test offline functionality

## 4. User Flow Validation

### Authentication Test
1. **Visit**: http://localhost:5173
2. **Action**: Enter email address
3. **Expected**: Magic link sent notification
4. **Action**: Check email and click magic link
5. **Expected**: Redirected to dashboard, authenticated

### List Management Test
1. **Action**: Click "Create List"
2. **Expected**: Modal with list type options
3. **Action**: Select "Simple" and enter title
4. **Expected**: New list appears in dashboard
5. **Action**: Click on list to open
6. **Expected**: List view with add item input

### Simple List Test
1. **Action**: Add item "Buy milk"
2. **Expected**: Item appears in list
3. **Action**: Mark item as complete
4. **Expected**: Item shows completed state
5. **Action**: Add multiple items and reorder
6. **Expected**: Drag and drop reordering works

### Grocery List Test
1. **Action**: Create grocery list "Weekly Shopping"
2. **Action**: Add items: "Apples", "Bread", "Eggs"
3. **Expected**: Items appear with checkboxes
4. **Action**: Check off "Apples"
5. **Expected**: Item shows checked state, moves to completed section

### Countdown List Test
1. **Action**: Create countdown list "Project Deadline"
2. **Action**: Add item with future date/time
3. **Expected**: Live countdown timer displays
4. **Action**: Wait for countdown to update
5. **Expected**: Timer decreases in real-time
6. **Action**: Set date in past
7. **Expected**: Expired message with dismiss option

### Sharing Test
1. **Action**: Click share button on a list
2. **Expected**: Share modal opens
3. **Action**: Enter email and select "edit" permission
4. **Expected**: Share link generated
5. **Action**: Open incognito window, visit share link
6. **Expected**: Prompted to login, then can edit list

### Offline Test
1. **Action**: Disconnect internet
2. **Action**: Create new list and add items
3. **Expected**: Works offline, shows offline indicator
4. **Action**: Reconnect internet
5. **Expected**: Changes sync automatically

### PWA Installation Test
1. **Action**: Look for install prompt in browser
2. **Expected**: "Install App" option appears
3. **Action**: Install the PWA
4. **Expected**: App icon added to home screen/desktop
5. **Action**: Open from home screen
6. **Expected**: Launches in standalone mode

## 5. Performance Validation

### Load Time Test
1. **Action**: Clear browser cache
2. **Action**: Navigate to application
3. **Expected**: Initial content loads within 2 seconds
4. **Measure**: Use browser dev tools Performance tab

### Mobile Responsiveness Test
1. **Action**: Open browser dev tools
2. **Action**: Toggle device toolbar (mobile view)
3. **Expected**: UI adapts to mobile layout
4. **Action**: Test touch interactions
5. **Expected**: All buttons/inputs work with touch

### Accessibility Test
1. **Action**: Tab through interface using keyboard only
2. **Expected**: All interactive elements are focusable
3. **Action**: Use screen reader
4. **Expected**: ARIA labels provide clear descriptions
5. **Action**: Test with voice control
6. **Expected**: Voice commands work correctly

## 6. Data Limits Validation

### List Limits Test
1. **Action**: Create 10 lists
2. **Expected**: All lists created successfully
3. **Action**: Try to create 11th list
4. **Expected**: Error message about limit reached

### Item Limits Test
1. **Action**: Add 100 items to a single list
2. **Expected**: All items added successfully
3. **Action**: Try to add 101st item
4. **Expected**: Error message about limit reached

### Share Expiration Test
1. **Action**: Create share link
2. **Action**: Wait 24 hours (or modify database for testing)
3. **Expected**: Share link no longer works
4. **Expected**: Expired shares cleaned up automatically

## 7. Error Scenarios

### Network Error Test
1. **Action**: Disconnect during sync operation
2. **Expected**: Graceful error handling, retry mechanism
3. **Action**: Invalid API responses
4. **Expected**: User-friendly error messages

### Data Corruption Test
1. **Action**: Corrupt local storage data
2. **Expected**: Application recovers, syncs from server
3. **Action**: Server database issues
4. **Expected**: Offline mode continues working

## 8. Success Criteria

✅ **Authentication**: Magic link login works end-to-end
✅ **List Management**: All three list types function correctly
✅ **Offline Support**: Full CRUD operations work offline
✅ **Real-time Sync**: Changes appear immediately across devices
✅ **PWA Features**: Installable, offline-capable, responsive
✅ **Performance**: <2s load time, smooth 60fps animations
✅ **Accessibility**: ARIA compliant, keyboard navigable
✅ **Data Limits**: 10 lists, 100 items per list enforced
✅ **Security**: RLS policies prevent unauthorized access
✅ **Sharing**: 24-hour expiration, role-based permissions

## 9. Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check

# PWA validation
npm run pwa-check
```

## 10. Deployment

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configure environment variables in Vercel dashboard
```

### Post-Deployment Validation
1. **Test**: Production URL loads correctly
2. **Test**: PWA installation works
3. **Test**: All user flows function
4. **Test**: Environment variables configured
5. **Test**: Database connections work
6. **Monitor**: Performance and error tracking

## Troubleshooting

### Common Issues
- **Magic links not received**: Check email settings in Supabase
- **Database connection failed**: Verify environment variables
- **PWA not installing**: Check manifest.json and HTTPS requirement
- **Offline sync issues**: Verify service worker registration
- **Performance issues**: Check bundle size and lazy loading
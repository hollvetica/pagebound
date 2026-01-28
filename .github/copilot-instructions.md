# Pagebound AI Coding Agent Instructions

## Project Overview
Pagebound is a React-based social reading app with AWS backend infrastructure. It enables users to track reading sessions, follow friends, and maintain synchronized reading progress without spoilers.

## Architecture Overview

### Frontend (React 18.2.0)
- **Entry Point**: `src/index.js` configures three context providers in order:
  1. `AuthProvider` - AWS Cognito authentication
  2. `SessionProvider` - Reading session state management
  3. `ThemeProvider` - 8-theme CSS variable system
- **Routing**: Manual client-side routing in `src/App.js` (no React Router)
- **Styling**: CSS variables + CSS modules. Theme colors applied via `ThemeContext` to document root

### Backend (AWS)
- **Auth**: Cognito User Pool (email verification required)
- **API**: Lambda functions (`userAPI.js`) + API Gateway (endpoint in `.env` as `REACT_APP_API_ENDPOINT`)
- **Data**: DynamoDB table `pagebound-users` with email as primary key
- **Email**: SES for welcome/password reset emails
- **IaC**: `backend/cloudformation-template.yaml` defines all AWS resources

### Design System (Separate Vite+TypeScript Project)
- Located in `design/Create Reading App UI/`
- Figma-exported Radix UI components (shadcn/ui style)
- **Not directly used by main app** - serves as reference and component library
- Build: `vite build` (uses tailwindcss vite plugin)

## Key Data Flows

### Authentication
1. User signs up via Cognito (email verification required)
2. PostConfirmation Lambda trigger calls DynamoDB to create user profile
3. Username stored alongside email in `pagebound-users` table
4. Friends relationships stored in `friends` array (email-based)
5. AuthContext wraps app and provides `useAuth()` hook with: `user`, `userProfile`, `error`, `loading`

### API Communication
- All user data accessed via REST API at `REACT_APP_API_ENDPOINT`
- Endpoints defined in `backend/lambda/userAPI.js` (GET/POST/PUT patterns)
- Error handling: fetch-based with console logging, no centralized error boundary

### Theme System
- `themes.js` exports 8 theme objects with: `colors` (15 properties), `fonts`, `backgroundPattern` (SVG), `backgroundSize`
- CSS variables applied to `document.documentElement` in `ThemeContext`
- Theme persisted to localStorage (`pagebound-theme`)
- Components access via `useTheme()` hook: `{ theme, currentTheme, changeTheme, availableThemes }`

## Development Workflows

### Start Development
```bash
npm start          # Starts React dev server (port 3000)
npm run build      # Production build
npm test           # Jest tests
```

### AWS Setup (First Time)
Follow `AWS_SETUP_CHECKLIST.md`:
1. Create Cognito User Pool + Client
2. Create DynamoDB table `pagebound-users`
3. Deploy Lambda functions from `backend/lambda/`
4. Configure `amplifyConfig.js` with Cognito IDs
5. Set `REACT_APP_API_ENDPOINT` in `.env`

### Deploy Frontend
- Configured for AWS Amplify (`amplify.yml`)
- Runs `npm run build` → serves `build/` directory

## Project Conventions

### Context Providers
- Must be nested in specific order (see Frontend section)
- Always export custom hooks: `useAuth()`, `useTheme()`, `useSession()`
- Hooks throw if context not found (validates proper provider wrapping)

### API Utilities
- All API calls in `src/utils/userService.js`
- Pattern: fetch + error logging + null return on failure (no exceptions propagated)
- Error messages: descriptive console.error, not user-facing

### Pages vs Components
- **Pages** (`src/pages/`) = Route destinations (Home, Library, Sessions, Profile, Settings, Admin, Login, Signup, PasswordReset)
- **Components** (`src/components/`) = Reusable UI pieces (BottomNav, ThemeSelector, ActiveSessions, etc.)
- Pages receive navigation callbacks: `onNavigateToSettings`, `onNavigateToAdmin`

### Styling
- **Global**: `src/index.css` defines CSS variable references
- **Component**: CSS modules (matching .js names: `Button.js` + `Button.css`)
- **Themes**: Applied via root CSS variables, no component-level theme overrides
- Pattern: `var(--color-primary)`, `var(--font-heading)`, etc.

## Critical Integration Points

### Cognito-to-DynamoDB Bridge
- PostConfirmation Lambda (`backend/lambda/createUserProfile.js`) auto-creates profile
- Username validation: scan entire table (no GSI) - expensive, consider optimization
- Email is immutable primary key throughout system

### Admin System
- Super admin hardcoded: `hollie.tanner@gmail.com` (immutable status)
- Admin status stored in DynamoDB `isAdmin` boolean
- Admin panel: `src/pages/Admin.js` - full user management UI

### Friend System
- Friends stored as email array in `pagebound-users` record
- No separate Friends table - denormalized design
- When username changes, friendship remains valid (tied to email)

## Common Patterns to Replicate

### Adding a New Page
1. Create `src/pages/NewPage.js` + `src/pages/NewPage.css`
2. Import in `App.js` and add case to `renderPage()` switch
3. Add navigation button in `BottomNav.js` or appropriate component
4. Pass any needed callbacks: `onNavigateTo<Page>`

### Adding Theme Support
1. Add object to `src/themes.js` with required keys: `name`, `colors` (15 properties), `fonts`, `backgroundPattern`, `backgroundSize`
2. Automatic availability via `useTheme().availableThemes`
3. No component changes needed - CSS variables handle rest

### Adding API Endpoint
1. Implement handler in `backend/lambda/userAPI.js` (GET/POST/PUT switch logic)
2. Export utility function in `src/utils/userService.js`
3. Call from component via `useEffect` + error handling pattern shown in `userService.js`

## Files to Never Modify Without Understanding
- `src/amplifyConfig.js` - Cognito connection (IDs must match AWS setup)
- `src/context/AuthContext.js` - Auth state machine (affects entire app)
- `backend/cloudformation-template.yaml` - Infrastructure (any change requires redeployment)
- `src/themes.js` - Theme schema (8 themes are interdependent)

## Debugging Tips
- Check `.env` file exists with `REACT_APP_API_ENDPOINT` set
- Cognito errors: check user pool ID + client ID in `amplifyConfig.js`
- API 404s: verify Lambda function deployed and environment variables set in Lambda config
- Theme not applying: check localStorage (`pagebound-theme`) and CSS variable names in browser DevTools
- Friend updates failing: scan for email format issues (must be lowercase consistently)

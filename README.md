# Pagebound Authentication System

Complete user authentication and admin system for Pagebound.

## What's New

### User Features
- ✅ Email/password signup with email confirmation
- ✅ Password validation (6 characters minimum with visual checkmark)
- ✅ Unique username selection
- ✅ Welcome email after signup
- ✅ Password reset functionality
- ✅ Settings page to change username and theme
- ✅ Username changes preserve all friendships (tied to email)

### Admin Features
- ✅ Admin panel with user grid showing email, username
- ✅ Reset password button for any user
- ✅ Checkbox to grant/revoke admin status
- ✅ Super admin (hollie.tanner@gmail.com) with irrevocable status
- ✅ Only super admin can create new admins

## File Structure

```
pagebound-auth-complete/
├── src/
│   ├── components/          [KEEP YOUR EXISTING FILES]
│   ├── context/
│   │   ├── AuthContext.js   [NEW - replace if exists]
│   │   ├── ThemeContext.js  [KEEP YOUR EXISTING]
│   │   └── SessionContext.js [KEEP YOUR EXISTING]
│   ├── pages/
│   │   ├── Login.js         [NEW]
│   │   ├── Login.css        [NEW]
│   │   ├── Signup.js        [NEW]
│   │   ├── Signup.css       [NEW]
│   │   ├── PasswordReset.js [NEW]
│   │   ├── PasswordReset.css[NEW]
│   │   ├── Settings.js      [NEW]
│   │   ├── Settings.css     [NEW]
│   │   ├── Admin.js         [NEW]
│   │   ├── Admin.css        [NEW]
│   │   ├── Profile.js       [REPLACE]
│   │   ├── Profile.css      [REPLACE]
│   │   ├── Home.js          [KEEP YOUR EXISTING]
│   │   ├── Library.js       [KEEP YOUR EXISTING]
│   │   └── Sessions.js      [KEEP YOUR EXISTING]
│   ├── utils/
│   │   └── userService.js   [NEW]
│   ├── App.js               [REPLACE]
│   ├── App.css              [REPLACE]
│   ├── index.js             [REPLACE]
│   ├── amplifyConfig.js     [NEW]
│   └── [other files]        [KEEP YOUR EXISTING]
├── backend/
│   ├── lambda/
│   │   ├── createUserProfile.js
│   │   └── userAPI.js
│   └── cloudformation-template.yaml
├── .env.example             [NEW - copy to .env]
├── package.json             [MERGE with your existing]
└── AWS_SETUP_CHECKLIST.md   [READ THIS FIRST]
```

## Installation Steps

### Step 1: Replace Files

**IMPORTANT:** Back up your current project first!

```bash
# In your pagebound project directory
cp -r pagebound-auth-complete/src/* src/
```

This will:
- Add all NEW files
- Replace App.js, App.css, index.js, Profile.js, Profile.css
- Keep all your existing components and pages

### Step 2: Install Dependencies

```bash
npm install aws-amplify
```

### Step 3: Follow AWS Setup

Open and follow **AWS_SETUP_CHECKLIST.md** step by step.

The checklist will guide you through:
1. Setting up AWS services (Cognito, DynamoDB, Lambda, SES)
2. Getting your configuration IDs
3. Updating `amplifyConfig.js` with your IDs
4. Creating `.env` file with your API endpoint
5. Deploying Lambda functions
6. Creating your admin account

### Step 4: Test Locally

```bash
npm start
```

1. You should see the login page
2. Click "Sign up"
3. Create account with email, username, password (min 6 chars)
4. Check email for confirmation code
5. Confirm and log in

### Step 5: Deploy to Production

```bash
git add .
git commit -m "Add complete authentication system"
git push
```

Don't forget to add environment variables in AWS Amplify console!

## File Replacement Details

### Files You MUST Replace:
- `src/App.js` - Now handles authentication flow and new pages
- `src/App.css` - Added loading states and back button
- `src/index.js` - Now includes AuthProvider
- `src/pages/Profile.js` - New version with Settings/Admin links
- `src/pages/Profile.css` - Updated styles

### Files You Should NOT Touch:
- All your components (BookSearch, ActiveSessions, etc.)
- Your existing pages (Home, Library, Sessions, BookDetail)
- ThemeContext, SessionContext
- themes.js, mockData.js
- All CSS for existing components

### New Files Being Added:
- Everything in `context/AuthContext.js`
- Everything in `pages/` with "Login", "Signup", "PasswordReset", "Settings", "Admin"
- Everything in `utils/userService.js`
- `amplifyConfig.js`
- `.env.example`

## Configuration Files

### amplifyConfig.js

After AWS setup, update these values:

```javascript
userPoolId: 'YOUR_USER_POOL_ID',        // From CloudFormation Outputs
userPoolClientId: 'YOUR_USER_POOL_CLIENT_ID', // From CloudFormation Outputs
```

### .env

Create this file in project root:

```
REACT_APP_API_ENDPOINT=YOUR_API_ENDPOINT  # From CloudFormation Outputs
```

## Super Admin Account

The first account you create with email `hollie.tanner@gmail.com` will be the super admin:
- Can access Admin Panel
- Admin status cannot be revoked
- Only account that can grant admin privileges to others

## Testing Checklist

After setup, test these features:

### Authentication
- [ ] Sign up with email/password/username
- [ ] Password must be 6+ characters (see green checkmark)
- [ ] Receive confirmation email
- [ ] Confirm account with code
- [ ] Receive welcome email
- [ ] Log in with credentials
- [ ] Log out

### User Settings
- [ ] Change username
- [ ] Username change preserves friendships
- [ ] Change theme
- [ ] See updated profile immediately

### Password Reset
- [ ] Request password reset
- [ ] Receive reset code email
- [ ] Enter code and new password (6+ chars)
- [ ] Log in with new password

### Admin Panel (hollie.tanner@gmail.com only)
- [ ] See Admin Panel button in Profile
- [ ] View grid of all users
- [ ] See your account marked as Super Admin
- [ ] Grant admin status to another user
- [ ] That user can now see Admin Panel
- [ ] Revoke admin status (not your own)
- [ ] Send password reset to any user
- [ ] Cannot revoke super admin status

## Troubleshooting

**Build errors after file replacement:**
- Make sure you installed `aws-amplify`: `npm install aws-amplify`
- Delete `node_modules` and `package-lock.json`, then `npm install`

**"Module not found: userService":**
- Make sure `src/utils/userService.js` exists
- Check that the file was copied correctly

**Authentication not working:**
- Verify `amplifyConfig.js` has correct IDs
- Check `.env` file exists with API endpoint
- Restart development server after creating .env

**Admin panel not showing:**
- Make sure your account email is exactly `hollie.tanner@gmail.com`
- Check DynamoDB table to verify `isAdmin: true`
- Log out and log back in

## Architecture

### Frontend (React)
- **AuthContext**: Manages authentication state, signup, login, logout
- **Login/Signup/PasswordReset**: Authentication UI
- **Settings**: User profile management
- **Admin**: User administration panel
- **userService**: API calls to backend

### Backend (AWS)
- **Cognito**: User authentication, email verification
- **DynamoDB**: User profiles (email, username, isAdmin, friends)
- **Lambda Functions**:
  - `createUserProfile`: Triggered on signup, creates DynamoDB record, sends welcome email
  - `userAPI`: Handles all API requests (get user, update username, admin actions)
- **API Gateway**: REST API endpoints for user management
- **SES**: Sends emails (confirmation, welcome, password reset)

### Data Flow
1. User signs up → Cognito creates auth account
2. Cognito triggers Lambda → Creates DynamoDB profile + sends welcome email
3. User logs in → Frontend gets user data from DynamoDB
4. Username change → Updates DynamoDB, preserves friendships (tied to email)
5. Admin actions → Calls API → Lambda updates DynamoDB/Cognito

## Security Notes

- Passwords: 6 character minimum (will expand later per PRD)
- Email verification required before login
- Usernames are public, emails are private
- Only super admin can create other admins
- Super admin status is permanent and irrevocable
- Friends are tied to email (backend), not username (frontend display)

## Cost Estimate

Using AWS Free Tier:
- Cognito: 50,000 MAUs free
- DynamoDB: 25GB storage free
- Lambda: 1M requests free
- API Gateway: 1M requests free (first 12 months)
- SES: 62,000 emails/month free (when sending from AWS)

Expected cost for < 1000 users: **$0-5/month**

## Next Steps

After authentication is working:
1. Build friend system using DynamoDB friends array
2. Connect sessions to real users instead of mock data
3. Add real-time features
4. Implement book discussions

## Support

If you run into issues:
1. Check AWS_SETUP_CHECKLIST.md
2. Verify all configuration values are correct
3. Check CloudWatch logs for Lambda errors
4. Check browser console for frontend errors

---

Built for Pagebound v2.0 with complete authentication 🔐

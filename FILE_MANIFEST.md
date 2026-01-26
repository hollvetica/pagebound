# FILE MANIFEST - What Goes Where

## 🆕 NEW FILES (Add these)

### Frontend - Authentication Pages
- src/pages/Login.js
- src/pages/Login.css
- src/pages/Signup.js
- src/pages/Signup.css
- src/pages/PasswordReset.js
- src/pages/PasswordReset.css
- src/pages/Settings.js
- src/pages/Settings.css
- src/pages/Admin.js
- src/pages/Admin.css

### Frontend - Context & Utils
- src/context/AuthContext.js
- src/utils/userService.js

### Frontend - Configuration
- src/amplifyConfig.js
- .env.example (copy to .env after AWS setup)

### Backend - Lambda Functions
- backend/lambda/createUserProfile.js
- backend/lambda/userAPI.js

### Backend - Infrastructure
- backend/cloudformation-template.yaml

### Documentation
- AWS_SETUP_CHECKLIST.md
- README.md

---

## 🔄 REPLACE THESE FILES

### Updated Core Files
✅ src/App.js
   - WHY: Adds authentication flow, Settings page, Admin page
   - SAFE: Preserves all your existing page routing

✅ src/App.css
   - WHY: Adds loading container, back button styles
   - SAFE: Keeps all existing styles

✅ src/index.js
   - WHY: Wraps app with AuthProvider
   - SAFE: Keeps ThemeProvider and SessionProvider

✅ src/pages/Profile.js
   - WHY: New version with Settings/Admin navigation
   - SAFE: Uses AuthContext to show user data

✅ src/pages/Profile.css
   - WHY: New styles for navigation buttons
   - SAFE: Maintains existing theme system

---

## ✋ DO NOT TOUCH (Keep Your Existing Files)

### Your Components (100% unchanged)
- src/components/ActivityFeed.js
- src/components/ActivityFeed.css
- src/components/ActiveSessions.js
- src/components/ActiveSessions.css
- src/components/BookSearch.js
- src/components/BookSearch.css
- src/components/BottomNav.js
- src/components/BottomNav.css
- src/components/CreateSession.js
- src/components/CreateSession.css
- src/components/QuickSessionSetup.js
- src/components/QuickSessionSetup.css
- src/components/ThemeSelector.js
- src/components/ThemeSelector.css
- src/components/UpdateProgress.js
- src/components/UpdateProgress.css

### Your Context (100% unchanged)
- src/context/ThemeContext.js
- src/context/SessionContext.js

### Your Pages (100% unchanged)
- src/pages/Home.js
- src/pages/Home.css
- src/pages/Library.js
- src/pages/Library.css
- src/pages/Sessions.js
- src/pages/Sessions.css
- src/pages/BookDetail.js
- src/pages/BookDetail.css

### Your Data & Config (100% unchanged)
- src/themes.js
- src/mockData.js
- src/index.css

---

## 📦 UPDATE (Merge Changes)

### package.json
ADD this dependency:
```json
"aws-amplify": "^6.0.0"
```

Keep all your existing dependencies!

---

## 🎯 Installation Options

### Option 1: Use Install Script (Recommended)
```bash
chmod +x install.sh
./install.sh
```

The script:
- ✅ Backs up files being replaced (adds .backup extension)
- ✅ Copies all new files
- ✅ Replaces only the 5 files that need updating
- ✅ Keeps all your existing components/pages untouched
- ✅ Installs npm dependencies

### Option 2: Manual Installation
1. Copy all NEW files to your project
2. Replace the 5 REPLACE files
3. Run `npm install aws-amplify`
4. Follow AWS_SETUP_CHECKLIST.md

---

## 🔍 How to Verify Installation

After installation, you should have:

```
your-project/
├── src/
│   ├── components/          [YOUR FILES - unchanged]
│   │   ├── ActivityFeed.js  ✓
│   │   ├── BookSearch.js    ✓
│   │   └── ... (all your components)
│   ├── context/
│   │   ├── AuthContext.js   [NEW] ✨
│   │   ├── SessionContext.js [YOURS] ✓
│   │   └── ThemeContext.js  [YOURS] ✓
│   ├── pages/
│   │   ├── Admin.js         [NEW] ✨
│   │   ├── Admin.css        [NEW] ✨
│   │   ├── BookDetail.js    [YOURS] ✓
│   │   ├── Home.js          [YOURS] ✓
│   │   ├── Library.js       [YOURS] ✓
│   │   ├── Login.js         [NEW] ✨
│   │   ├── Login.css        [NEW] ✨
│   │   ├── PasswordReset.js [NEW] ✨
│   │   ├── PasswordReset.css [NEW] ✨
│   │   ├── Profile.js       [REPLACED] 🔄
│   │   ├── Profile.css      [REPLACED] 🔄
│   │   ├── Sessions.js      [YOURS] ✓
│   │   ├── Settings.js      [NEW] ✨
│   │   ├── Settings.css     [NEW] ✨
│   │   ├── Signup.js        [NEW] ✨
│   │   └── Signup.css       [NEW] ✨
│   ├── utils/
│   │   └── userService.js   [NEW] ✨
│   ├── App.js               [REPLACED] 🔄
│   ├── App.css              [REPLACED] 🔄
│   ├── amplifyConfig.js     [NEW] ✨
│   ├── index.js             [REPLACED] 🔄
│   ├── index.css            [YOURS] ✓
│   ├── mockData.js          [YOURS] ✓
│   └── themes.js            [YOURS] ✓
├── backend/
│   ├── lambda/
│   │   ├── createUserProfile.js [NEW] ✨
│   │   └── userAPI.js       [NEW] ✨
│   └── cloudformation-template.yaml [NEW] ✨
├── .env.example             [NEW] ✨
├── AWS_SETUP_CHECKLIST.md   [NEW] ✨
├── README.md                [NEW] ✨
└── package.json             [UPDATED] 🔄
```

Legend:
- ✨ = New file added
- 🔄 = File replaced with updated version
- ✓ = Your original file, unchanged

---

## ⚠️ Important Notes

1. **Backups**: Install script creates .backup files for everything it replaces
2. **No Data Loss**: All your components, pages, and logic remain intact
3. **Safe Integration**: New auth wraps around your existing app
4. **Reversible**: If anything breaks, restore from .backup files

---

## 🚀 After Installation

1. Check that all files are in place (see verification above)
2. Open AWS_SETUP_CHECKLIST.md
3. Follow each step to set up AWS services
4. Update amplifyConfig.js and .env
5. Test locally: `npm start`
6. Deploy: `git push`

---

Total Files:
- 21 new files
- 5 replaced files
- 30+ existing files kept unchanged

Your app's existing functionality is 100% preserved! 🎉

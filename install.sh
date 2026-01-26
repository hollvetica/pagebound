#!/bin/bash
# Pagebound Authentication - Quick Install Script

echo "🔐 Installing Pagebound Authentication System..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from your pagebound project root directory"
    echo "   (where package.json is located)"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install aws-amplify

echo ""
echo "📋 Copying new files..."

# Copy all new files
cp -r pagebound-auth-complete/src/context/AuthContext.js src/context/ 2>/dev/null || true
cp -r pagebound-auth-complete/src/utils src/ 2>/dev/null || true
cp -r pagebound-auth-complete/src/pages/Login.* src/pages/ 2>/dev/null || true
cp -r pagebound-auth-complete/src/pages/Signup.* src/pages/ 2>/dev/null || true
cp -r pagebound-auth-complete/src/pages/PasswordReset.* src/pages/ 2>/dev/null || true
cp -r pagebound-auth-complete/src/pages/Settings.* src/pages/ 2>/dev/null || true
cp -r pagebound-auth-complete/src/pages/Admin.* src/pages/ 2>/dev/null || true
cp pagebound-auth-complete/src/amplifyConfig.js src/ 2>/dev/null || true

echo ""
echo "🔄 Replacing updated files..."
echo "   (Your original files are backed up as .backup)"

# Backup and replace files
cp src/App.js src/App.js.backup 2>/dev/null || true
cp src/App.css src/App.css.backup 2>/dev/null || true
cp src/index.js src/index.js.backup 2>/dev/null || true
cp src/pages/Profile.js src/pages/Profile.js.backup 2>/dev/null || true
cp src/pages/Profile.css src/pages/Profile.css.backup 2>/dev/null || true

cp pagebound-auth-complete/src/App.js src/
cp pagebound-auth-complete/src/App.css src/
cp pagebound-auth-complete/src/index.js src/
cp pagebound-auth-complete/src/pages/Profile.js src/pages/
cp pagebound-auth-complete/src/pages/Profile.css src/pages/

echo ""
echo "📄 Creating .env.example..."
cp pagebound-auth-complete/.env.example .

echo ""
echo "✅ Installation complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 NEXT STEPS:"
echo ""
echo "1. Follow the AWS_SETUP_CHECKLIST.md guide"
echo "   It will walk you through setting up AWS services"
echo ""
echo "2. After AWS setup, update these files:"
echo "   - src/amplifyConfig.js (add your User Pool IDs)"
echo "   - .env (create from .env.example, add API endpoint)"
echo ""
echo "3. Test locally:"
echo "   npm start"
echo ""
echo "4. Deploy to production:"
echo "   git add ."
echo "   git commit -m \"Add authentication system\""
echo "   git push"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your original files are backed up with .backup extension"
echo "Ready to set up AWS! Open AWS_SETUP_CHECKLIST.md to begin."
echo ""

#!/bin/bash
# ============================================================
# Swara Aqua — Production Build Script for Hostinger
# Run from: ~/swara_aqua/
# ============================================================
set -e

echo "📦 Installing backend dependencies..."
cd backend
npm install

echo "🔨 Building backend TypeScript..."
./node_modules/.bin/tsc
echo "✅ Backend built → dist/"
cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo "🔨 Building frontend..."
./node_modules/.bin/vite build

echo "📁 Copying frontend dist → backend/public..."
rm -rf ../backend/public
cp -r dist ../backend/public
cd ..

# ── Place .htaccess in the correct public_html ────────────────────────────────
# Hostinger stores domains at ~/domains/DOMAIN/public_html
DOMAIN_DIR=$(find ~/domains -maxdepth 1 -mindepth 1 -type d 2>/dev/null | head -1)
if [ -n "$DOMAIN_DIR" ]; then
  # Hostinger Git deployment puts app in nodejs/ subfolder
  APPDIR="$DOMAIN_DIR/nodejs"
else
  APPDIR=~/nodejs
fi

echo "📁 Creating .env in $APPDIR/backend/"
mkdir -p "$APPDIR/backend"

USERNAME=$(whoami)

# Only create .env if it doesn't exist (don't overwrite secrets)
if [ ! -f "$APPDIR/backend/.env" ]; then
cat > "$APPDIR/backend/.env" << EOF
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=${USERNAME}_swara_aqua
DB_PASSWORD=Swara_aqua@123
DB_NAME=${USERNAME}_swara_aqua
DB_SSL=false
JWT_SECRET=change_this_to_random_string_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_this_to_another_random_string
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://swaraaqua.labxco.in
FIREBASE_PROJECT_ID=waterdelivery-a2126
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@waterdelivery-a2126.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="YOUR_FIREBASE_PRIVATE_KEY_HERE"
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
EOF
  echo "✅ .env created — edit $APPDIR/backend/.env to add real secrets"
else
  echo "✅ .env already exists, skipping"
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "Now in hPanel → Node.js:"
echo "  Application root:    ~/swara_aqua/backend"
echo "  Startup file:        app.js"
echo "  Node.js version:     18 (or 20)"
echo "  → Click Restart"

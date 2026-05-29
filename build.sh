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
# Vite embeds VITE_* at build time (required for FCM / background push)
export VITE_FIREBASE_API_KEY=AIzaSyBuM5DkMqfW-STRiEyi3OCIVWk8E3aHz7g
export VITE_FIREBASE_AUTH_DOMAIN=waterdelivery-a2126.firebaseapp.com
export VITE_FIREBASE_PROJECT_ID=waterdelivery-a2126
export VITE_FIREBASE_STORAGE_BUCKET=waterdelivery-a2126.firebasestorage.app
export VITE_FIREBASE_MESSAGING_SENDER_ID=86432708341
export VITE_FIREBASE_APP_ID=1:86432708341:web:d89c23e595ca4df023b7bc
export VITE_FIREBASE_MEASUREMENT_ID=G-DPGK2X7N59
export VITE_FIREBASE_VAPID_KEY=BNutSNz9HosmoEOeGzgz2TibmCtwPBKpgJaq0ty57b0zL1PUHbKSX4bNOKlrvHW16Ej8n5TSdkjiOpVnDvj5eMk
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
# Firebase: use JSON file (upload backend/config/firebase-service-account.json via File Manager)
FIREBASE_SERVICE_ACCOUNT_PATH=config/firebase-service-account.json
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

#!/bin/bash
# ============================================================
# Swara Aqua — Production Build Script
# ============================================================
set -e

echo "📦 Installing backend dependencies..."
cd backend
npm install

echo "🔨 Building backend..."
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

# ── Copy .htaccess to the domain public_html ─────────────────────────────────
# Hostinger stores public_html at ~/domains/DOMAIN/public_html
# Find it automatically
PUBHTML=$(find ~/domains -maxdepth 2 -name "public_html" -type d 2>/dev/null | head -1)
if [ -z "$PUBHTML" ]; then
  PUBHTML=~/public_html
fi

echo "📁 Copying .htaccess → $PUBHTML"
cp public_html/.htaccess "$PUBHTML/.htaccess"

echo ""
echo "✅ Build complete!"
echo "  → Go to hPanel → Node.js → click Restart"
echo "  → Then visit your domain"

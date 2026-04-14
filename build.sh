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
  PUBHTML="$DOMAIN_DIR/public_html"
else
  PUBHTML=~/public_html
fi

echo "📁 Writing .htaccess → $PUBHTML/.htaccess"
mkdir -p "$PUBHTML"

# Get the home directory username
USERNAME=$(whoami)

cat > "$PUBHTML/.htaccess" << EOF
PassengerEnabled on
PassengerAppRoot /home/${USERNAME}/swara_aqua/backend
PassengerStartupFile app.js
PassengerAppType node
PassengerNodejs /usr/bin/node

Options -MultiViews -Indexes
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
EOF

echo ""
echo "✅ Build complete!"
echo ""
echo "Now in hPanel → Node.js:"
echo "  Application root:    ~/swara_aqua/backend"
echo "  Startup file:        app.js"
echo "  Node.js version:     18 (or 20)"
echo "  → Click Restart"

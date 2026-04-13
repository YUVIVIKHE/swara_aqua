#!/bin/bash
# ============================================================
# Swara Aqua — Production Build Script
# Run this on Hostinger SSH or locally before uploading
# ============================================================
set -e

echo "📦 Installing backend dependencies..."
cd backend
npm install --omit=dev
npm install typescript ts-node-dev --save-dev
echo "🔨 Building backend (TypeScript → JS)..."
npm run build
cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
npm install
echo "🔨 Building frontend (Vite)..."
npm run build
echo "📁 Copying frontend dist → backend/public..."
rm -rf ../backend/public
cp -r dist ../backend/public
cd ..

echo "✅ Build complete!"
echo ""
echo "Next steps on Hostinger:"
echo "  1. Upload the entire project to your hosting root"
echo "  2. In hPanel → Node.js → set entry point: backend/dist/index.js"
echo "  3. Set Node version to 18+"
echo "  4. Add all env vars from backend/.env in hPanel environment variables"
echo "  5. Click 'Restart' in the Node.js panel"

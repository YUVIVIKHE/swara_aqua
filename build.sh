#!/bin/bash
# ============================================================
# Swara Aqua — Production Build Script
# Run this on Hostinger SSH after cloning the repo
# ============================================================
set -e

echo "📦 Installing backend dependencies (including devDeps for tsc)..."
cd backend
npm install
echo "🔨 Building backend (TypeScript → JS)..."
npm run build
echo "✅ Backend built → dist/"
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

echo ""
echo "✅ Build complete! Now:"
echo "  1. In hPanel → Node.js: set startup file to backend/dist/index.js"
echo "  2. Set NODE_ENV=production in hPanel env vars"
echo "  3. Add all other env vars from backend/.env"
echo "  4. Click Restart"

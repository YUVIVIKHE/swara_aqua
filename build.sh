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

echo ""
echo "✅ Build complete!"
echo "  → Restart your app in hPanel → Node.js → Restart"

#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( dirname "$SCRIPT_DIR" )"
cd "$ROOT_DIR" || exit 1
echo "========================================================="
echo "⚙️  OPM OFFICE LOCAL AGENT AUTOMATOR"
echo "========================================================="
if [ ! -d "node_modules" ]; then
    echo "📦 Dependency folder missing. Executing npm install..."
    npm install
else
    echo "✓ Package dependencies verified."
fi
echo "📡 Invoking public YouTube sync scraper..."
npx tsx utils/pull-youtube-data.ts
if [ -f "public/data/youtube-media.json" ]; then
    echo "✓ Success: Live YouTube media catalog compiled to public/data/youtube-media.json"
else
    echo "⚠️ Warning: Media catalog could not be compiled. Falling back to default records."
fi
echo "🚀 Starting OPM Office local web server..."
npm run dev || npx vite

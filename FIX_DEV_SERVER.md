# Fix Dev Server Issues

If you're seeing MODULE_NOT_FOUND errors, follow these steps:

## Step 1: Stop the Dev Server
Press `Ctrl+C` in the terminal where the dev server is running.

## Step 2: Clear All Caches
```bash
npm run clean
# or manually:
rm -rf .next
```

## Step 3: Clear Node Modules Cache (if needed)
```bash
rm -rf node_modules/.cache
```

## Step 4: Restart Dev Server
```bash
npm run dev:clean
# or:
npm run dev
```

## Step 5: Hard Refresh Browser
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

## If Still Not Working

### Option 1: Full Clean Install
```bash
rm -rf .next node_modules
npm install
npm run dev
```

### Option 2: Check for Port Conflicts
```bash
# Kill any process on port 3000
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Option 3: Use Different Port
```bash
PORT=3001 npm run dev
```

## Common Causes
1. **Stale cache** - `.next` folder has corrupted files
2. **Port conflict** - Another process using port 3000
3. **File watching issues** - macOS file system limits
4. **Module resolution** - TypeScript/Webpack cache issues

## Quick Fix Command
```bash
rm -rf .next && npm run dev
```


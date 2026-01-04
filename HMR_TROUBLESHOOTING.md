# HMR (Hot Module Replacement) Troubleshooting Guide

If changes aren't reflecting after refreshing the page in dev mode, try these solutions:

## Quick Fixes

### 1. Clear Next.js Cache
```bash
npm run clean
# or manually:
rm -rf .next
```

Then restart the dev server:
```bash
npm run dev
```

### 2. Use Clean Dev Start
```bash
npm run dev:clean
```

This automatically clears the cache and starts the dev server.

### 3. Try Turbo Mode (if available)
```bash
npm run dev:turbo
```

## Common Issues & Solutions

### Issue: Changes not reflecting after page refresh

**Solution 1: Hard Refresh Browser**
- Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Firefox: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
- Safari: `Cmd+Option+R`

**Solution 2: Clear Browser Cache**
- Open DevTools → Application → Clear Storage → Clear site data

**Solution 3: Check File Watching**
- On macOS, file watching can be limited. The config now uses polling as a fallback.
- If issues persist, increase the poll interval in `next.config.js`:
  ```js
  poll: 2000, // Check every 2 seconds instead of 1
  ```

### Issue: Dev server not detecting changes

**Solution: Restart Dev Server**
```bash
# Stop the server (Ctrl+C)
npm run dev:clean
```

### Issue: Stale modules

**Solution: Clear node_modules and reinstall**
```bash
rm -rf node_modules .next
npm install
npm run dev
```

## Configuration

The `next.config.js` has been updated with:
- **Polling**: Checks for file changes every second (helps on macOS)
- **Aggregate Timeout**: Waits 300ms before rebuilding (reduces rebuild frequency)
- **Ignored Files**: Excludes `node_modules` from watching

## Still Not Working?

1. Check if you're editing files in `node_modules` or `.next` (these won't trigger HMR)
2. Ensure you're using `"use client"` directive in client components
3. Check browser console for HMR errors
4. Verify your file paths are correct (case-sensitive on some systems)
5. Try disabling browser extensions that might interfere

## Environment-Specific Notes

### macOS
- File watching can be limited by system settings
- Polling is enabled by default to work around this
- If you see "too many files" errors, increase system limits:
  ```bash
  echo kern.maxfiles=65536 | sudo tee -a /etc/sysctl.conf
  echo kern.maxfilesperproc=65536 | sudo tee -a /etc/sysctl.conf
  ```

### Windows
- Ensure WSL file watching is properly configured if using WSL
- Check antivirus isn't blocking file watching

### Linux
- Usually works well with default settings
- If issues occur, check inotify limits:
  ```bash
  cat /proc/sys/fs/inotify/max_user_watches
  ```


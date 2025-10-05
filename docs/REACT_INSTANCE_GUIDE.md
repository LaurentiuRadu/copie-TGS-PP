# React Instance Management Guide

## 🎯 Problem: "Invalid Hook Call / Dispatcher is Null"

This error occurs when multiple React instances exist in the bundle, causing hooks to fail.

## ✅ Current Solution (WORKING)

The application is now configured correctly with these settings:

### 1. `vite.config.ts` - Minimal and Clean

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
  // CRITICAL: Ensure only ONE React instance exists
  dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  preserveSymlinks: false,
}
```

**What NOT to do:**
- ❌ Do NOT manually clear Vite cache in dev mode
- ❌ Do NOT add `optimizeDeps.include` or `optimizeDeps.force`
- ❌ Do NOT alias React packages from node_modules
- ❌ Do NOT add aggressive pre-bundling configurations

### 2. `package.json` - Version Enforcement

Add this to enforce single React version across all dependencies:

```json
"overrides": {
  "react": "18.3.1",
  "react-dom": "18.3.1"
}
```

**Note:** This field must be added manually to `package.json` (Lovable AI cannot modify it directly).

### 3. Diagnostics in `main.tsx`

The app includes automatic detection and recovery:
- Logs React version and module information
- Detects multiple React instances
- Attempts auto-recovery by clearing caches
- Provides clear console messages

## 🛡️ Golden Rules to Prevent Future Issues

### Rule 1: Keep `vite.config.ts` Simple
- Only use `resolve.dedupe` for React packages
- Let Vite handle pre-bundling automatically
- No manual cache clearing
- No forced optimizations

### Rule 2: Package Management
When adding new packages:

1. **Check peer dependencies:**
   ```bash
   npm info [package-name] peerDependencies
   ```
   Ensure it accepts `react: ^18.x`

2. **Verify single React version:**
   ```bash
   npm ls react react-dom
   ```
   Should show only ONE version for each

3. **If a package brings incompatible React:**
   - Add to `overrides` in `package.json`
   - Or find an alternative package

### Rule 3: Clean Development Environment

If you encounter issues, run this cleanup sequence:

```bash
# 1. Clean all caches and dependencies
rm -rf node_modules/.vite dist node_modules package-lock.json

# 2. Fresh install
npm install

# 3. Verify React versions
npm ls react react-dom

# 4. Start dev server
npm run dev
```

### Rule 4: Monitor Console in Development

Watch for these messages:
- ✅ `Single React instance confirmed` - All good!
- ❌ `Multiple React instances detected` - Problem detected, auto-recovery will attempt

## 🔍 Verification Script

Run the verification script after building:

```bash
npm run build
node scripts/verify-react-bundle.js
```

Expected output:
```
✅ VERDICT: Single React instance confirmed
```

## 📦 Safe Package Addition Checklist

Before installing any new package:

- [ ] Check if it has `react` as peerDependency
- [ ] Verify it supports React 18.x
- [ ] Check npm for known React instance issues
- [ ] After installation, run `npm ls react react-dom`
- [ ] Test the dev server thoroughly
- [ ] Check browser console for React warnings

## 🚨 Warning Signs

Watch for these indicators of React instance issues:

1. **Console Errors:**
   - "Invalid hook call"
   - "Hooks can only be called inside the body of a function component"
   - "Rendered more hooks than during the previous render"

2. **Build Output:**
   - Multiple React chunks with different hashes
   - Warnings about duplicated modules

3. **Bundle Analysis:**
   - Multiple entries for `react` or `react-dom` in bundle

## 🔧 Troubleshooting

### Issue: Dev server shows blank screen
**Solution:** Clear browser cache and Vite cache:
```bash
rm -rf node_modules/.vite
# Then hard refresh browser (Ctrl+Shift+R)
```

### Issue: Works in dev but fails in production
**Solution:** Run verification script and check build output:
```bash
npm run build
node scripts/verify-react-bundle.js
```

### Issue: New package causes React errors
**Solution:** Check and enforce version:
1. `npm ls react react-dom` to identify the culprit
2. Add to `overrides` in `package.json`
3. `npm install` to apply overrides
4. Restart dev server

## 📚 Additional Resources

- [React Docs: Invalid Hook Call](https://react.dev/warnings/invalid-hook-call-warning)
- [Vite Docs: Dependency Pre-Bundling](https://vitejs.dev/guide/dep-pre-bundling.html)
- [Vite Docs: resolve.dedupe](https://vitejs.dev/config/shared-options.html#resolve-dedupe)

## ✨ Current Status

As of last update:
- ✅ `vite.config.ts` simplified
- ✅ `resolve.dedupe` configured
- ✅ Diagnostics added to `main.tsx`
- ✅ Verification script in place
- ⚠️ `package.json` overrides need manual addition

**The app is currently working correctly with single React instance!**

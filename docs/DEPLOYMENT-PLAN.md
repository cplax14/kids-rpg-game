# Monster Quest RPG - Web Deployment Plan

## Overview

Deploy the kids RPG game for browser access so it can be played from any device with a web browser.

---

## Phase 1: Essential Deployment ✅ COMPLETE

**Goal:** Get the game live on the web with minimal changes.

### Tasks Completed

1. **Build Configuration** (`vite.config.ts`)
   - Disabled sourcemaps for production (smaller bundle, no code inspection)
   - Added Phaser chunk splitting (~1MB separate chunk for better caching)
   - Configured output directory as `dist`

2. **HTML Meta Tags** (`index.html`)
   - Added SEO description meta tag
   - Added mobile viewport configuration (no user scaling)
   - Added theme-color for browser chrome
   - Added Apple web app capability tags

3. **Vercel Deployment**
   - Framework: Vite (auto-detected)
   - Build command: `pnpm build`
   - Output directory: `dist`
   - HTTPS, CDN, auto-deploy on push

### Production Build Stats
- Total size: 3.3MB
- Phaser chunk: 332KB gzipped
- Game code: 57KB gzipped
- Load time: ~2-3 seconds on broadband

---

## Phase 2: Save Data Improvements ✅ COMPLETE

**Goal:** Improve save data reliability and enable cross-device play.

### Completed Tasks

1. **Save Export/Import** ✅
   - Added "Export Save" button in Settings panel
   - Downloads save data as JSON file with metadata
   - Added "Import Save" button with file picker
   - Slot selection dialogs for export/import
   - Enables manual backup and device transfer

2. **Multiple Save Slots** ✅ (Already existed)
   - 3 save slots supported via `SAVE_SLOTS` config
   - Save slot selection UI in SaveLoadPanel
   - Each slot shows player name, level, play time

3. **Save Data Validation** ✅
   - Added `SaveGameSchema` with Zod validation
   - `validateSaveData()` function for import validation
   - User-friendly error messages on invalid imports
   - Graceful handling of corrupted saves

4. **Auto-Save Indicators** ⏭️ (Deferred)
   - Lower priority, can add later

### Files Modified
- `src/models/schemas.ts` - Added SaveGameSchema
- `src/systems/SaveSystem.ts` - Export/import/validation functions
- `src/ui/menus/SettingsPanel.ts` - Export/import UI with dialogs
- `tests/unit/systems/SaveSystem.test.ts` - 11 new tests (743 total)

---

## Phase 3: Mobile & Touch Support ✅ COMPLETE

**Goal:** Make the game fully playable on tablets and phones.

### Completed Tasks

1. **Touch Controls** ✅
   - Virtual D-pad for movement (bottom-left, 160px circular)
   - Action button "A" for interact (bottom-right, 70px)
   - Menu button "☰" for opening menu (above action button)
   - Cancel button "X" for back/cancel actions (left of action button)
   - Auto-detection of touch devices
   - Debug override via `?touch=true` or `?touch=false` URL params

2. **Responsive Scaling** ✅ (Already existed)
   - Phaser Scale.FIT mode with CENTER_BOTH
   - Minimum resolution: 640x360
   - Target resolution: 1280x720

3. **Mobile Detection Utilities** ✅
   - `isTouchDevice()` - Detects touch capability
   - `isMobileDevice()` - Detects mobile user agents
   - `shouldShowTouchControls()` - Combined logic with debug override
   - `getOrientation()` - Portrait/landscape detection
   - `onOrientationChange()` - Orientation change listener

### Files Created
- `src/ui/controls/VirtualDPad.ts` - Virtual D-pad with 4-direction input
- `src/ui/controls/ActionButton.ts` - Configurable action button
- `src/utils/mobile.ts` - Mobile detection utilities
- `tests/unit/utils/mobile.test.ts` - Mobile utility tests

### Files Modified
- `src/systems/InputSystem.ts` - Integrated touch controls with keyboard input

### Touch Control Layout
```
                                      ┌───┐
                                      │ ☰ │  Menu
                                      └───┘
  ┌─────────────┐                 ┌───┐ ┌───┐
  │   ▲         │                 │ X │ │ A │  Cancel / Action
  │ ◀   ▶       │                 └───┘ └───┘
  │   ▼         │
  └─────────────┘
   Virtual D-Pad
```

---

## Phase 4: PWA Setup

**Goal:** Enable "Add to Home Screen" for app-like experience.

### Tasks

1. **Web App Manifest**
   - Create `manifest.json` with app metadata
   - Add app icons (192x192, 512x512)
   - Configure display mode (standalone)
   - Set theme and background colors

2. **Service Worker**
   - Cache game assets for offline play
   - Cache Phaser and game bundles
   - Handle offline gracefully

3. **Install Prompt**
   - Detect PWA install capability
   - Show "Add to Home Screen" prompt
   - Track installation state

### Files to Create
- `public/manifest.json` - PWA manifest
- `public/sw.js` - Service worker
- `public/icons/` - App icons directory
- `src/systems/PWASystem.ts` - Install prompt handling

---

## Phase 5: Performance & Security

**Goal:** Optimize performance and add security measures.

### Tasks

1. **Asset Optimization**
   - Compress images with WebP format
   - Lazy load non-critical assets
   - Implement asset preloading strategy

2. **Performance Monitoring**
   - Add FPS counter (debug mode)
   - Monitor memory usage
   - Track loading times

3. **Security Hardening**
   - Content Security Policy headers
   - Prevent save data tampering (checksums)
   - Rate limit any future API calls

4. **Analytics (Optional)**
   - Track play sessions
   - Monitor error rates
   - Measure engagement

### Files to Modify
- `vercel.json` - Security headers
- `src/scenes/PreloaderScene.ts` - Asset optimization
- `src/systems/SaveSystem.ts` - Save data checksums

---

## Deployment Checklist

### Before Launch
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test on iOS Safari and Android Chrome
- [ ] Verify save/load works correctly
- [ ] Check all game areas accessible
- [ ] Confirm battle system works
- [ ] Test quest acceptance and completion

### Post-Launch
- [ ] Monitor error reports
- [ ] Check loading times
- [ ] Gather user feedback
- [ ] Plan future updates

---

## Technical Notes

### Hosting: Vercel
- Free tier sufficient for personal use
- Automatic HTTPS
- Global CDN distribution
- Auto-deploy on git push

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome for Android)

### localStorage Limits
- 5MB per origin (sufficient for save data)
- Cleared if user clears browser data
- Export feature mitigates data loss risk

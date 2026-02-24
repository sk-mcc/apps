# Selection Tool - Build Status

## Overview

Two tools in this directory:

1. **Clean-Up Tool** (`sort.html`) - Upload a multi-campus schedule spreadsheet, split it into separate campus files with bundle detection and validation flags. **Working.**
2. **South Campus Selection Tool** (`south.html`) - Live, editable selection schedule for faculty meetings with autosave, search, and Excel export. **Needs Firebase setup.**

## What's Done

### Clean-Up Tool (sort.html)
- Upload Excel schedule, auto-detect headers
- Split rows by campus (Center, South, Online)
- Bundle detection: 1170+1181, 2410+2420, online 1181 pairs
- Hybrid section handling (collapse dual rows, match by day + room)
- Validation flags: capacity issues, room conflicts, scheduling time mismatches
- Download individual campus files or combined spreadsheet
- Push South Campus data to Selection Tool via Firebase

### Selection Tool (south.html + login.html)
- Login page with email/password auth
- Schedule picker (list saved schedules)
- 16-column table with bundle color coding
- Editable fields: Faculty Selection, Notes
- Autosave with debounce (500ms)
- Search with automatic bundle expansion
- Column sorting that keeps bundles together
- Excel export (2-sheet workbook: Selection Sheet + Original Sorted)
- Delete schedule functionality
- Direct upload fallback (upload Excel straight to south.html)

### Architecture
- **Non-module scripts** (sort.html): `config.js`, `sort-processing.js`, `sort-excel.js`, `sort-main.js`
- **ES modules** (south.html): `auth.js`, `firebase-config.js`, `selection-firebase.js`, `selection-display.js`, `selection-export.js`, `selection-upload.js`
- Global functions accessed via `window.*` from ES modules
- `var` (not `let`) for globals that modules need (`sortedData`, `originalFilename` in sort-main.js)

## What's Left

### Firebase Setup (blocking)
`js/firebase-config.js` has placeholder values that need to be replaced with real credentials:

1. Create a Firebase project (separate from QuickPoll)
2. Enable **Realtime Database**
3. Enable **Email/Password Authentication**
4. Create user account(s) in Firebase Console
5. Copy the Firebase config into `js/firebase-config.js`
6. Set database security rules (restrict writes to authenticated users)
7. Push updated `firebase-config.js` to the `sk-mcc/apps` repo

### Deployment
- Live site: https://sk-mcc.github.io/apps/selection-tool/index.html
- Source repo: `sk-mcc/apps` (GitHub Pages, main branch)
- Dev repo: `sk-mcc/faculty-tools-github`
- Changes must be pushed to **both repos** (dev repo for local work, apps repo for live site)

## Key Gotchas
- `let` at top level in non-module `<script>` does NOT create `window.*` properties; use `var`
- Global functions (from config.js) must be called as `window.functionName()` inside ES modules
- Hybrid sections appear as 2 rows in schedule data (IPL + ONLN); the tool collapses them to 1
- Bundle matching requires **same day overlap** + same building/room, not just room alone

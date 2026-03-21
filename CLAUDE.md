# Faculty Tools GitHub

## Repository Structure
- **Working directory for apps:** `apps/` (the git root is one level above)
- **Live site (GitHub Pages):** `sk-mcc/apps` repo → https://sk-mcc.github.io/apps/
- **Development remote:** `origin` → `https://github.com/sk-mcc/faculty-tools-github.git`, branch `main`
- **Owner:** sk-mcc GitHub account
- **IMPORTANT:** The GitHub Pages site serves from the `sk-mcc/apps` repo, NOT `faculty-tools-github`. Always push to `sk-mcc/apps` for changes to go live.

## Apps Overview

### `faculty-tools/door-sign.html`
- Self-contained single-file HTML app (no build, no dependencies)
- Generates printable weekly office door signs from Self-Service schedule paste
- Parses ENGL course sections, times, days, locations
- Day parsing: "TH" must be extracted before "T" to avoid Tuesday/Thursday collision
- Section prefixes: S/C/H = in-person timetable, O = online-only listing
- Overlapping sections auto-merge
- Office hours support flexible formats (ranges, slash-separated, virtual)
- Generated HTML uses CSS Grid calendar; print styles target single-page letter portrait

### `selection-tool/` — Schedule cleanup + selection tool (sort.html, south.html, login.html)
### `QuickPoll/` — Polling tool (separate Firebase project)
### `faculty-tools/` — Additional Python tools (PDF accessibility, PDF-to-HTML)
### `podium/` — (needs documentation)

## Committing & Pushing
- Commit from the `apps/` directory (that's the git working directory)
- Push to `origin main`
- Commit messages should be descriptive of the what and why

## TODO
- As new apps are built or older apps are revisited, add their details to this file so Claude has full context for each tool.

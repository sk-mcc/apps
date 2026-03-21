# Faculty Tools

## Repository Structure
- **Git root:** `/home/skarlis/faculty-tools-github/` (one level above the apps)
- **Remote:** `origin` → `https://github.com/sk-mcc/apps.git`, branch `main`
- **GitHub Pages:** https://sk-mcc.github.io/apps/
- **Owner:** sk-mcc GitHub account
- **Note:** The old `sk-mcc/faculty-tools-github` repo has been archived. All work goes to `sk-mcc/apps`.

## CRITICAL: File Paths
- The git root is `/home/skarlis/faculty-tools-github/` but the repo tree has NO `apps/` prefix.
- Files tracked by git live at the **repo root level**: e.g. `faculty-tools/door-sign.html`, `QuickPoll/index.html`
- There is also a local `apps/` subdirectory with working copies — these are NOT tracked by git.
- **Always edit and stage files relative to the repo root**, not from `apps/`. For example:
  - Correct: `git add faculty-tools/door-sign.html` (from repo root)
  - Wrong: editing `apps/faculty-tools/door-sign.html` (untracked copy)
- When committing, run from the repo root or use paths relative to it.

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
- Push to `origin main` — this is what GitHub Pages serves
- Commit messages should be descriptive of the what and why

## TODO
- As new apps are built or older apps are revisited, add their details to this file so Claude has full context for each tool.

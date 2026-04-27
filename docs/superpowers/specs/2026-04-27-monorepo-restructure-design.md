# Monorepo Restructure Design

**Date:** 2026-04-27
**Status:** Approved

## Goal

Reorganize the StatSnap repository from a single frontend-at-root layout into a three-directory monorepo: `frontend/`, `backend/`, and `etl/`. No monorepo tooling is introduced; each sub-project is self-contained.

## Approach

Simple flat dirs, no tooling overhead. Each sub-project owns its own dependencies and config. The root holds only repo-wide files.

## Target Layout

```
StatSnap/
├── frontend/              # Vite/React app (moved from root)
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── package-lock.json
│   ├── node_modules/
│   ├── .eslintrc.cjs
│   ├── .prettierrc
│   └── .prettierignore
├── backend/               # Express/MongoDB (not started)
│   └── .gitkeep
├── etl/                   # Python nflverse ETL (not started)
│   └── .gitkeep
├── docs/
│   ├── superpowers/
│   ├── DECISIONS.md
│   └── NOTES.md
├── CLAUDE.md
├── README.md
├── .gitignore             # stays at root; covers all sub-projects
└── .editorconfig          # stays at root; repo-wide formatting
```

## What Moves Where

### Into `frontend/`
All files that belong to the Vite/React project:
- `src/`
- `index.html`
- `vite.config.js`
- `package.json` and `package-lock.json`
- `node_modules/`
- `.eslintrc.cjs` (frontend ESLint config)
- `.prettierrc` (frontend Prettier config)
- `.prettierignore`

### Stays at root
- `.gitignore` — already ignores `node_modules/`; stays at root to cover all three sub-projects
- `.editorconfig` — repo-wide editor formatting; applies to all sub-projects
- `README.md`, `CLAUDE.md`, `docs/`

### New empty dirs
- `backend/.gitkeep`
- `etl/.gitkeep`

## What Is Not Changed

- No new dependencies added
- No changes to any source files inside `src/`
- No changes to linting, formatting, or Vite config
- No root `package.json` created (no workspaces setup)

## Developer Workflow After Restructure

```bash
# Run frontend dev server
cd frontend && npm run dev

# Future: run backend
cd backend && npm install && npm run dev

# Future: run ETL
cd etl && python main.py
```

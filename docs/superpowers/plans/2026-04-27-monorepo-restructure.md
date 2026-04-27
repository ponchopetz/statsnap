# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all frontend files into `frontend/`, and create empty `backend/` and `etl/` placeholder directories, producing a clean three-directory monorepo layout.

**Architecture:** All moves use `git mv` so file history is preserved. `node_modules/` is gitignored and not moved — it is regenerated with `npm install` inside `frontend/` after the move. Root retains only repo-wide files.

**Tech Stack:** Bash, git, Node/npm (to verify Vite still starts after the move)

---

> **All commands run from the repo root:** `/Users/alfonsomartinezpetz/Desktop/TripleTen_SWE/StatSnap`

---

### Task 1: Move frontend files into frontend/

**Files:**
- Create dir: `frontend/`
- Move into `frontend/`: `src/`, `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `.eslintrc.cjs`, `.prettierrc`, `.prettierignore`

- [ ] **Step 1: Create the frontend directory**

```bash
mkdir frontend
```

Expected: no output, directory created.

- [ ] **Step 2: Move src/ and index.html**

```bash
git mv src frontend/src
git mv index.html frontend/index.html
```

Expected: no output from either command.

- [ ] **Step 3: Move Vite and package files**

```bash
git mv vite.config.js frontend/vite.config.js
git mv package.json frontend/package.json
git mv package-lock.json frontend/package-lock.json
```

Expected: no output.

- [ ] **Step 4: Move linting and formatting configs**

```bash
git mv .eslintrc.cjs frontend/.eslintrc.cjs
git mv .prettierrc frontend/.prettierrc
git mv .prettierignore frontend/.prettierignore
```

Expected: no output.

- [ ] **Step 5: Note on empty directories**

`src/assets/`, `src/contexts/`, and `src/hooks/` currently exist on disk but are empty — git has no tracked files inside them, so `git mv` will not move them. They will not appear under `frontend/src/`. This is fine; they can be recreated with `.gitkeep` files when content is added to them.

- [ ] **Step 6: Verify staged moves look correct**

```bash
git status
```

Expected output (order may vary):
```
On branch stage-1-frontend-and-api
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        renamed:    .eslintrc.cjs -> frontend/.eslintrc.cjs
        renamed:    .prettierignore -> frontend/.prettierignore
        renamed:    .prettierrc -> frontend/.prettierrc
        renamed:    index.html -> frontend/index.html
        renamed:    package-lock.json -> frontend/package-lock.json
        renamed:    package.json -> frontend/package.json
        renamed:    src/... -> frontend/src/...
        renamed:    vite.config.js -> frontend/vite.config.js
```

If anything looks wrong (extra files moved, wrong destinations), run `git restore --staged .` and redo the steps.

- [ ] **Step 6: Commit the moves**

```bash
git commit -m "Move frontend files into frontend/ directory"
```

Expected: commit created, lists all the renames.

---

### Task 2: Reinstall node_modules and verify the dev server

`node_modules/` was gitignored and was not moved by git. It still lives at the old root path. After the move, `frontend/package.json` expects `node_modules/` to be inside `frontend/`.

**Files:**
- Create: `frontend/node_modules/` (via npm install)

- [ ] **Step 1: Remove the old root-level node_modules**

```bash
rm -rf node_modules
```

Expected: no output. This avoids confusion — the old one is stale and in the wrong place.

- [ ] **Step 2: Install dependencies inside frontend/**

```bash
cd frontend && npm install
```

Expected: npm resolves packages and creates `frontend/node_modules/`. Lock file already exists so no version changes occur. Output ends with something like `added N packages`.

- [ ] **Step 3: Start the dev server to verify it works**

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:3000` and the app loads in the browser. Look for:
```
  VITE v5.x.x  ready in Nms

  ➜  Local:   http://localhost:3000/
```

Stop the server with `Ctrl+C` once confirmed working.

- [ ] **Step 4: Return to repo root**

```bash
cd ..
```

---

### Task 3: Create backend/ and etl/ placeholder directories

Git does not track empty directories. A `.gitkeep` file (empty, zero bytes) is the convention for committing an otherwise-empty dir.

**Files:**
- Create: `backend/.gitkeep`
- Create: `etl/.gitkeep`

- [ ] **Step 1: Create the placeholder files**

```bash
touch backend/.gitkeep etl/.gitkeep
```

Expected: no output. Two new files created.

- [ ] **Step 2: Stage and commit**

```bash
git add backend/.gitkeep etl/.gitkeep
git commit -m "Add backend/ and etl/ placeholder directories"
```

Expected: commit created with 2 new files.

---

### Task 4: Verify the final structure

- [ ] **Step 1: Check the directory tree**

```bash
find . -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.claude/*' | sort
```

Expected output should match this layout exactly (file count will vary inside `src/`):

```
.
./.editorconfig
./.gitignore
./CLAUDE.md
./README.md
./backend
./backend/.gitkeep
./docs
./docs/DECISIONS.md
./docs/NOTES.md
./docs/superpowers
./docs/superpowers/plans
./docs/superpowers/plans/2026-04-27-monorepo-restructure.md
./docs/superpowers/specs
./docs/superpowers/specs/2026-04-27-monorepo-restructure-design.md
./etl
./etl/.gitkeep
./frontend
./frontend/.eslintrc.cjs
./frontend/.prettierignore
./frontend/.prettierrc
./frontend/index.html
./frontend/package-lock.json
./frontend/package.json
./frontend/src
./frontend/src/...
./frontend/vite.config.js
```

Root should have **no** `src/`, `index.html`, `vite.config.js`, `package.json`, `.eslintrc.cjs`, `.prettierrc`, or `.prettierignore`.

- [ ] **Step 2: Commit this plan file if not already tracked**

```bash
git status
```

If `docs/superpowers/plans/2026-04-27-monorepo-restructure.md` appears as untracked:

```bash
git add docs/superpowers/plans/2026-04-27-monorepo-restructure.md
git commit -m "Add monorepo restructure implementation plan"
```

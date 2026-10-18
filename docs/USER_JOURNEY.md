# Patch — User Journey & State Mapping

**Version:** 1.0.0 (Milestone 1 — Batch 1)  
**Hackathon:** WeMakeDevs × FalkorDB Graph Hacks (Track 1)  

---

## 1. Primary User Journey

The primary journey is centered around transitioning from **reactive vulnerability anxiety** to **systematic graph investigation and verified resolution**.

```
[ Enter Patch ]
       │
       ▼
[ Workspace / Portfolio ] ─── Empty state: Prompt to add first repository
       │
       ▼ (Enter public GitHub URL, e.g. "https://github.com/Emafido/quikapi")
[ Ingestion Pipeline ] ─── Loading state: Validating URL → Fetching metadata → Arborist build → FalkorDB sync
       │
       ├───────────────── Error state: Invalid URL / Missing lockfile / Unsupported v1 lockfile
       ▼
[ Repository Loaded ] ─── Success state: Ingestion metrics (Direct vs Transitive, Snapshot ID)
       │
       ▼ (Search / Select package, e.g. "postcss")
[ Graph Investigation ] ─── Traversal: "Why does postcss exist?"
       │                    Chain: Root ➔ next@16.2.6 ➔ postcss@8.4.31
       │                    Introducing Direct Dep: "next"
       │                    Cross-Repo Presence: "Also in ghost & Ekotrace"
       ▼
[ Future Milestones ] ─── Vulnerability Overlay ➔ Remediation Ranking ➔ Upgrade Verification ➔ PR Export
```

---

## 2. Step-by-Step Experience (Milestone 1 & 2 Focus)

### Step 1: Open Patch & Workspace Context
- **User Action:** Navigates to the Patch application.
- **System State:** Loads the default developer portfolio workspace.
- **Empty State:** If no repositories have been imported yet, the workspace presents a clean, focused prompt with a repository URL input and quick-start demonstration fixtures (`Emafido/quikapi`, `Emafido/ghost`, `Emafido/Ekotrace`).

### Step 2: Add Public GitHub Repository
- **User Action:** Enters or pastes a public GitHub repository URL into the ingestion field and clicks **"Import Repository"** (or presses Enter).
- **Validation:** Client instantly validates the URL structure (must be a valid GitHub repo format: `https://github.com/:owner/:repo` or `:owner/:repo`).
- **Loading State:**
  - Ingestion progress bar / spinner activates.
  - Informative stage messages:
    1. *"Connecting to GitHub..."*
    2. *"Resolving lockfile structure with npm Arborist..."*
    3. *"Constructing dependency graph in FalkorDB..."*
  - The submit button is disabled to prevent duplicate concurrent submissions.

### Step 3: Handle Ingestion Outcomes
- **Success State:**
  - A success toast/badge confirms: *"Successfully imported Emafido/quikapi (Snapshot #12345)"*.
  - The newly imported repository appears in the repository selector.
  - Summary metrics display immediately: Total Packages, Direct Dependencies, Transitive Dependencies, and Snapshot Timestamp.
- **Failure / Recovery State:**
  - Clear, user-friendly error banners are displayed with specific diagnostic guidance:
    - *Missing lockfile:* "No `package-lock.json` found in this repository. Patch requires an npm lockfile to construct an accurate dependency graph."
    - *Unsupported lockfile version:* "Detected lockfile version 1. Patch supports modern npm lockfile version 2 and 3. Please run `npm install` on npm 7+ and push the updated lockfile."
    - *Repository not found / private:* "Repository could not be found or is private. Please verify the URL."

### Step 4: Investigate Packages & Dependency Lineage
- **User Action:** 
  - The user selects an imported repository.
  - The user scrolls or types in the search filter (e.g., `"postcss"` or `"semver"`).
- **Graph Traversal State:**
  - When a package is clicked, Patch executes a parameterized Cypher query against FalkorDB.
  - The investigation panel opens, showing:
    1. **Package Details:** Canonical name, installed version, direct vs transitive flag, production vs development dependency.
    2. **Dependency Origin ("Why is this installed?"):** The exact shortest directed path from the root project node to this package instance (e.g., `QuikAPI (root) ➔ next@16.2.6 ➔ postcss@8.4.31`).
    3. **Root Cause Attribution:** Explicit callout: *"Introduced by direct dependency: next"*.
    4. **Cross-Repository Visibility:** FalkorDB checks if other snapshots in the portfolio contain the same package version and highlights: *"Also used in 2 other repositories: Emafido/ghost, Emafido/Ekotrace"*.

---

## 3. Essential UI States Matrix

| View / Component | Empty State | Loading State | Success State | Error State |
| :--- | :--- | :--- | :--- | :--- |
| **Ingestion Bar** | Input field with placeholder and quick fixture pills. | Disabled input, animated spinner, stage text. | Input resets; success badge with repository name. | Error banner beneath input with recovery suggestions. |
| **Repository Selector** | "No repositories added yet. Import a GitHub repository above to start." | Skeleton cards representing repository fetching. | Selectable repository card / dropdown with package count and snapshot time. | N/A (Repository list remains interactive even if one import fails). |
| **Package Explorer** | List of all packages with search input. | Skeleton rows during graph query execution. | Filterable list with badges (Direct / Transitive, Dev / Prod). | "No packages match query '<search>'". |
| **Dependency Path Panel** | "Select a package from the list to investigate its dependency lineage." | Pulse skeleton showing graph path segments. | Interactive path tree showing nodes from Root to Leaf with versions. | "Could not resolve dependency path in graph. Node may be orphaned." |

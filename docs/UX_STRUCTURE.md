# Patch — UX Structure & Success Criteria

**Version:** 1.0.0 (Milestone 1 — Batch 1)  
**Hackathon:** WeMakeDevs × FalkorDB Graph Hacks (Track 1)  

---

## 1. Information Architecture (IA)

Patch is organized into a clean, developer-focused, single-page reactive workspace with two primary functional zones:

```
┌────────────────────────────────────────────────────────────────────────┐
│  PATCH ⬡ [FalkorDB Connected]                      Portfolio: Default  │
├────────────────────────────────────────────────────────────────────────┤
│  [1] INGESTION BAR                                                     │
│  [ https://github.com/owner/repo              ] [ Import Repository ]  │
│  Quick Fixtures: [quikapi] [ghost] [Ekotrace] [sindresorhus/is]        │
├────────────────────────────────────┬───────────────────────────────────┤
│  [2] REPOSITORY SELECTOR           │  [3] DEPENDENCY INVESTIGATION     │
│  ┌───────────────────────────────┐ │  Package: postcss@8.4.31          │
│  │ ● Emafido/quikapi             │ │  Direct Dep: false  Type: prod    │
│  │   28 direct · 412 total       │ │  Introduced by: next              │
│  │   Snapshot: 2026-10-14 14:02  │ │                                   │
│  ├───────────────────────────────┤ │  DEPENDENCY PATH:                 │
│  │ ○ Emafido/ghost               │ │  QuikAPI (root)                   │
│  │   14 direct · 230 total       │ │    └── next@16.2.6                │
│  └───────────────────────────────┘ │          └── postcss@8.4.31       │
│                                    │                                   │
│  PACKAGE LIST                      │  CROSS-REPOSITORY PRESENCE:       │
│  [ Search packages...           ]  │  • Also installed in Emafido/ghost│
│  • next@16.2.6 [direct] [prod]    │                                   │
│  • postcss@8.4.31 [transitive]    │                                   │
│  • react@19.0.0 [direct] [prod]   │                                   │
└────────────────────────────────────┴───────────────────────────────────┘
```

---

## 2. Screen Structures & Wireframe Specifications

### Zone 1: Workspace Header & Global Ingestion Bar
- **Purpose:** Provide immediate orientation, database status, and a primary action area for importing repositories without navigation friction.
- **Components:**
  - **Brand Mark:** "PATCH" with graph symbol and track indicator ("Graph Hacks Track 1").
  - **FalkorDB Status Indicator:** A live pill badge showing `FalkorDB: Active` (or `FalkorDB: Mock Mode` if running without live cloud instance).
  - **Repository Input Field:** Full-width input with placeholder `https://github.com/owner/repository`.
  - **Action Button:** "Import Repository" (with loading spinner state).
  - **Preset Quick-Test Fixtures:** One-click pills for hackathon verification (`Emafido/quikapi`, `Emafido/ghost`, `Emafido/Ekotrace`, `sindresorhus/is`).
  - **Notification / Error Banner:** Displays inline validation warnings or detailed network/parsing error diagnostics.

### Zone 2: Repository List & Package Filter
- **Purpose:** Manage active repositories in the portfolio and select packages for investigation.
- **Components:**
  - **Repository Selector:** Cards showing repository name, direct package count, total package count, and snapshot timestamp.
  - **Package Filter Bar:** Real-time text search to quickly locate direct or transitive packages by name.
  - **Package Table / List:** Clean tabular list displaying package name, resolved version, `[direct]` vs `[transitive]` badge, and `[prod]` vs `[dev]` badge.

### Zone 3: Dependency Investigation Panel
- **Purpose:** Answer the core user questions: *"Why does this package exist?"*, *"Which direct dependency introduced it?"*, and *"Where else is it used?"*
- **Components:**
  - **Package Header:** Name, version, installation path (`node_modules/...`).
  - **Introducing Direct Dependency Callout:** Highlighted badge showing the top-level direct dependency responsible for this package.
  - **Dependency Path Chain (Tree / Breadcrumbs):** Directed visual sequence from project root through intermediate parents to the leaf package.
  - **Cross-Repository Visibility Box:** Queries the portfolio for other repositories containing the exact same `PackageVersion`, showing cross-project footprint.

---

## 3. Measurable Success Criteria (Task 1.6)

| Dimension | Success Target | Verification Method |
| :--- | :--- | :--- |
| **Import Success** | Ingest valid GitHub repos with npm lockfile v3/v2 in < 5 seconds. | Automated test against `Emafido/quikapi`. |
| **Invalid Input Handling** | Reject malformed URLs, non-existent repos, and missing lockfiles with human-actionable error messages. | Unit tests for validator; browser UI test. |
| **Lockfile v1 Handling** | Gracefully detect and explain unsupported lockfile v1 format with instructions to regenerate. | Unit test with fixture containing `"lockfileVersion": 1`. |
| **Dependency Resolution** | Full parity with npm Arborist in-memory tree (resolving direct, transitive, hoisted, and nested duplicates). | Cross-check Arborist `node.edgesOut` against FalkorDB `DEPENDS_ON` edges. |
| **Graph Query Correctness** | Shortest path query returns exact chain (e.g. `QuikAPI ➔ next@16.2.6 ➔ postcss@8.4.31`). | Integration test executing Cypher path query. |
| **Cross-Repo Isolation** | Traversal queries strictly stay within the active snapshot; no edge bleeding between repositories. | Dual-repo integration test verifying path queries do not jump snapshots. |
| **Safety Boundaries** | Zero execution of package lifecycle scripts (`preinstall`, `postinstall`). | Static parsing verified; no shell execution during ingestion. |
| **Accessibility & Usability** | Full keyboard navigability (Tab, Enter, Arrow keys), semantic HTML5, WCAG AA contrast ratio. | Web design audit via browser subagent. |

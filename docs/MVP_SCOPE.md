# Patch — MVP Scope & Phasing Boundary

**Version:** 1.0.0 (Milestone 1 — Batch 1)  
**Hackathon:** WeMakeDevs × FalkorDB Graph Hacks (Track 1)  

---

## 1. Eventual MVP Scope (Milestones 1 – 4)

The end-to-end MVP delivered by the conclusion of the hackathon will feature:

| Feature Area | MVP Requirement | Delivery Milestone |
| :--- | :--- | :--- |
| **Repository Ingestion** | Import arbitrary public npm repositories via GitHub URL; validate root `package.json` and `package-lock.json` (v2 & v3). | **Milestone 2 (Current Batch)** |
| **Graph Modeling** | Store accurate graph hierarchy in FalkorDB (Portfolio, Repository, Snapshot, Installation, PackageVersion). | **Milestone 2 (Current Batch)** |
| **Dependency Lineage** | Query exact directed dependency paths from root to transitive packages; identify introducing direct dependencies. | **Milestone 2 (Current Batch)** |
| **Cross-Repo Overlap** | Discover identical package versions across different repositories within the portfolio via FalkorDB Cypher queries. | **Milestone 2 (Current Batch)** |
| **Vulnerability Association** | Associate package versions with known vulnerability advisories (OSV / GitHub Advisory Database). | Milestone 3 |
| **Cross-Repo Blast Radius** | Correlate shared vulnerabilities across multiple repositories; quantify shared exposure. | Milestone 3 |
| **Remediation Ranking** | Rank candidate upgrade targets based on path distance, breaking change risk, and vulnerability resolution. | Milestone 3 |
| **Upgrade Verification** | Simulate package version upgrades in an isolated virtual scratch environment; verify tree validity before and after. | Milestone 4 |
| **Bounded AI Agent** | Grounded agent answering natural-language queries against FalkorDB graph evidence without hallucinating. | Milestone 4 |
| **Evidence-Backed Reports** | Export structured before-and-after audit logs and remediation proposals. | Milestone 4 |

---

## 2. Explicit Non-Goals (Not in Initial MVP)

To maintain high technical quality, avoid scope creep, and ensure the product remains tightly focused:

1. **Private Repositories & SSH:** The MVP exclusively supports public GitHub repositories. No personal access token management, OAuth app permissions, or SSH key handling.
2. **Automated Pull Request Creation:** Patch will compute verified upgrade instructions and diffs, but will not write to or create GitHub PRs automatically.
3. **Non-npm Package Managers:** Yarn (`yarn.lock`), pnpm (`pnpm-lock.yaml`), and Bun (`bun.lockb`) are deferred. Only npm lockfiles (version 2 and 3) are supported.
4. **Execution of Untrusted Application Code:** Patch will never run `npm install` directly in the host OS or trigger lifecycle scripts (`preinstall`, `postinstall`). All dependency parsing is performed statically using `@npmcli/arborist`.
5. **Multi-Tenant User Management & Billing:** Single-user portfolio workspace model. No authentication, enterprise RBAC, or subscription tiers.

---

## 3. Strict Boundary for Milestone 2 (Current Implementation)

For this current batch, implementation is strictly bounded to:
- **Included in Milestone 2:**
  - Next.js TypeScript foundation.
  - Server-side FalkorDB client integration (with cloud and mock fallback for zero-dependency execution).
  - GitHub public repository fetcher (with rate-limit handling and size caps).
  - `@npmcli/arborist` lockfile parsing and tree construction.
  - FalkorDB graph schema creation and Cypher queries.
  - Minimal functional interface for importing repositories and inspecting dependency paths.
  - Automated test suites (lockfiles, graph queries, isolation, fixtures).
- **Excluded from Milestone 2:**
  - Vulnerability advisory ingestion / CVE matching.
  - AI chat agents or LLM integrations.
  - Upgrade simulation and automated remediation.
  - Polished dashboard widgets, security score gauges, or analytics graphs.

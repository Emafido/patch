# Patch — Product Specification

**Version:** 1.0.0 (Milestone 1 — Batch 1)  
**Hackathon:** WeMakeDevs × FalkorDB Graph Hacks (Track 1: Agents That Act on Connected Data)  
**Status:** Approved for Implementation  

---

## 1. Product Overview

**Patch** is a general-purpose dependency security investigation and remediation platform designed for modern JavaScript/TypeScript ecosystems. While existing security tools scan codebases to flag vulnerabilities, Patch leverages **FalkorDB** as a graph-native intelligence engine to understand **how** vulnerable dependencies enter an application, uncover **shared risks across multiple repositories**, and enable **evidence-backed, verified upgrade simulations**.

---

## 2. Problem Statement (Task 1.1)

### 2.1 The Core Problem
Modern software development is built on deep, complex dependency trees. A typical Node.js web application might declare 30 direct dependencies in its `package.json`, which resolve to over 1,500 installed packages in `package-lock.json`. 

When a vulnerability advisory (CVE) is published for a transitive dependency:
1. **Attribution Blindness:** The developer is notified that package `foo@1.2.0` has a high-severity vulnerability, but they have no idea which direct dependency pulled it in or why it is present.
2. **Upgrade Friction & Fear:** Upgrading direct dependencies blindly often introduces breaking API changes or fails to bump the vulnerable nested dependency due to semantic version constraints.
3. **Cross-Project Silos:** Developers and teams manage multiple repositories with overlapping stacks. A vulnerability in a shared package (e.g., `postcss`, `axios`, or `semver`) must be investigated individually across each repository, leading to redundant manual triage and inconsistent fixes.
4. **Alert Fatigue without Actionable Path:** Existing tools output flat lists of CVE alerts. Developers are left with `npm audit fix --force`, which frequently breaks builds by updating major versions indiscriminately.

### 2.2 Target Users Affected
- **Independent Developers:** Maintain 5–15 personal, client, or open-source JavaScript/TypeScript repositories. They lack dedicated AppSec teams and need an instant, reliable answer to: *"Which direct package must I update to fix this vulnerability, and will it break my app?"*
- **Small Software Teams & Agencies:** Manage 10–30+ client repositories. They require portfolio-level visibility: *"If a vulnerability hits `cookie` or `next`, which of our 12 client projects are exposed, and what are their specific dependency paths?"*

### 2.3 Existing Workflows & Limitations
| Tool / Workflow | How It Operates | Critical Limitations |
| :--- | :--- | :--- |
| **`npm audit`** | Scans local `package-lock.json` against the npm advisory database. | Scoped to a single project; terminal output is noisy; `--force` introduces breaking changes; no graph queryability; no cross-repo correlation. |
| **Dependabot / Snyk** | Scans repositories asynchronously and opens isolated automated pull requests. | High alert volume; generates separate PRs per repo without cross-repo coordination; does not explain deep transitive blast radiuses intuitively; PRs frequently fail CI due to breaking changes. |
| **Manual `npm ls <pkg>`** | Developer runs CLI commands per repo to print ASCII dependency trees. | Tedious across multiple projects; hard to query reverse dependencies or shared versions; non-interactive; no remediation modeling. |

### 2.4 Patch's Specific Proposed Value
1. **Graph-Native Dependency Traversal:** Storing the dependency network in FalkorDB allows instantaneous Cypher path queries answering: *"What is the exact chain from root to this package?"* and *"Which direct dependency introduces it?"*
2. **Cross-Repository Intelligence:** By mapping canonical package versions (`PackageVersion`) to project-scoped installations (`Installation`), Patch allows querying shared exposure across an entire portfolio with a single graph query.
3. **Path to Coordinated Remediation & Verification:** (Future milestones) Rather than guessing version bumps, Patch models candidate upgrades as graph mutations and verifies them in isolated scratch environments before opening pull requests.

### 2.5 Assumptions to Validate
- **Lockfile Primacy:** Parsing `package-lock.json` (v3 / v2) via `@npmcli/arborist` provides ground-truth resolution of what is installed, accounting for hoisting and nested duplicates without running untrusted scripts.
- **Developer Intent:** Developers care more about the *introducing direct dependency* than the 5 intermediate hops when planning remediation.
- **Performance:** FalkorDB can ingest and query dependency graphs with thousands of nodes and edges in sub-second response times.

---

## 3. Product Principles

1. **Graph-First by Design:** Relationships are primary citizens. If a query can be answered with a Cypher traversal, we do not perform in-memory array filtering.
2. **Zero Code Execution on Ingestion:** We parse metadata and lockfiles statically using npm Arborist. We never run `npm install`, `node postinstall.js`, or untrusted arbitrary code.
3. **Idempotency & Isolation:** Re-importing a repository creates clean, isolated snapshots. Dependency edges never bleed across repositories or snapshots.
4. **Usability Over Clutter:** The interface must be dense, clear, and focused on developer utility. No speculative dashboard widgets or decorative vanity metrics.
5. **Clear Error Recovery:** If a repository has an unsupported lockfile version or missing files, provide actionable diagnostic guidance immediately.

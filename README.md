# Patch ⬡

**Graph-Native Dependency Security Investigation & Remediation Platform**  
*Built for the WeMakeDevs × FalkorDB Graph Hacks Hackathon — Track 1: Agents That Act on Connected Data*

---

## 1. Product Vision

Patch transforms software dependency security from **cryptic flat vulnerability alerts** into **clear, queryable graph intelligence**. 

While existing scanners alert developers to transitive CVEs in isolated repositories, Patch utilizes **FalkorDB** to model complete dependency networks across a developer's entire portfolio. This answers three fundamental questions:
1. **Why does this vulnerable package exist?** (The exact directed path from the repository root to the transitive dependency).
2. **Which direct dependency introduced it?** (Identifying the single root-cause package requiring remediation).
3. **Where else in my portfolio is this package version used?** (Quantifying cross-repository exposure and shared blast radius).

---

## 2. FalkorDB Graph Architecture

Patch enforces strict **snapshot isolation** while allowing cross-repository intelligence through canonical package version pivots.

```
(:Portfolio) ──[:CONTAINS]──> (:Repository) ──[:HAS_SNAPSHOT]──> (:Snapshot)
                                                                    │
                                                               [:HAS_ROOT]
                                                                    ▼
                                                            (:Installation:Root)
                                                                    │
                                                              [:DEPENDS_ON]
                                                                    ▼
                                                            (:Installation) ──[:INSTANCE_OF]──> (:PackageVersion)
                                                                    │                                    ▲
                                                              [:DEPENDS_ON]                             │
                                                                    ▼                                    │
                                                            (:Installation) ────────[:INSTANCE_OF]───────┘
```

### Isolation Guarantee
- **`Installation` Nodes:** Scoped strictly to their snapshot (`${snapshotId}:${packagePath}`).
- **`[:DEPENDS_ON]` Edges:** Only connect `Installation` nodes belonging to the exact same snapshot. Dependency traversal queries never accidentally cross between repositories.
- **`PackageVersion` Nodes:** Canonical nodes (`${name}@${version}`) shared across repositories via incoming `[:INSTANCE_OF]` edges for cross-project queries.

---

## 3. Parameterized Cypher Queries

### 1. Packages in Snapshot
```cypher
MATCH (s:Snapshot { id: $snapshotId })-[:HAS_ROOT]->(root:Installation)
MATCH (root)-[:DEPENDS_ON*1..15]->(i:Installation)
RETURN DISTINCT i.id, i.name, i.version, i.isDirect, i.packagePath
ORDER BY i.name ASC;
```

### 2. Dependency Path Traversal ("Why is this installed?")
```cypher
MATCH (s:Snapshot { id: $snapshotId })-[:HAS_ROOT]->(root:Installation)
MATCH (target:Installation { id: $installationId })
MATCH p = shortestPath((root)-[:DEPENDS_ON*1..15]->(target))
RETURN [n IN nodes(p) | {
  id: n.id,
  name: n.name,
  version: n.version,
  isDirect: n.isDirect,
  packagePath: n.packagePath
}] as chain;
```

### 3. Cross-Repository Version Sharing
```cypher
MATCH (target:Installation { id: $installationId })-[:INSTANCE_OF]->(pv:PackageVersion)
MATCH (pv)<-[:INSTANCE_OF]-(otherI:Installation)
MATCH (otherI)<-[:DEPENDS_ON*0..15]-(otherRoot:Installation)<-[:HAS_ROOT]-(otherS:Snapshot)<-[:HAS_SNAPSHOT]-(otherR:Repository)
WHERE otherS.id <> $snapshotId AND otherS.status = 'SUCCESS'
RETURN DISTINCT otherR.id, otherR.name, otherR.url, otherS.id, otherI.isDirect;
```

---

## 4. Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 10
- FalkorDB (Cloud or local instance on port 6379) — *Note: If no FalkorDB instance is detected, Patch automatically operates via its built-in in-memory graph engine with 100% Cypher compatibility!*

### Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your FalkorDB credentials:
```env
# FalkorDB Cloud or local URL
FALKORDB_URL=redis://default:password@cloud.falkordb.com:6379

# Or individual parameters
FALKORDB_HOST=127.0.0.1
FALKORDB_PORT=6379
FALKORDB_PASSWORD=
FALKORDB_GRAPH_NAME=patch_dependency_graph
```

### Run Locally
```bash
# Install dependencies
npm install

# Run automated test suite
npm test

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Required Correctness Example

Using actual package data from `Emafido/quikapi`, Patch resolves and displays the exact path:
```
quikapi (root)
  └── next@16.2.6 (direct dependency)
        └── postcss@8.4.31 (transitive dependency)
```
- **Introducing Direct Dependency:** `next`
- **Cross-Repo Overlap:** Also discovered in `Emafido/ghost`

/**
 * FalkorDB Graph Schema Definition and Cypher Query Specifications
 * 
 * GRAPH ARCHITECTURE & ISOLATION GUARANTEE:
 * 1. (:Portfolio) CONTAINS (:Repository)
 * 2. (:Repository) HAS_SNAPSHOT (:Snapshot)
 * 3. (:Snapshot) HAS_ROOT (:Installation { id: snapshotId + ":root", name: repo.name })
 * 4. (:Installation) DEPENDS_ON (:Installation)
 * 5. (:Installation) INSTANCE_OF (:PackageVersion)
 * 
 * Strict Snapshot Isolation:
 * An (:Installation) node represents an installed package instance strictly scoped to a single
 * repository snapshot (ID format: `${snapshotId}:${packagePath}`).
 * The [:DEPENDS_ON] edges strictly connect (:Installation) nodes belonging to the SAME snapshot.
 * Canonical (:PackageVersion) nodes (ID format: `${name}@${version}`) are shared across repositories
 * via incoming [:INSTANCE_OF] edges.
 * 
 * Graph traversal queries following [:DEPENDS_ON*] NEVER cross snapshot or repository boundaries.
 * Cross-repository vulnerability impact and package reuse is queried exclusively through
 * (:PackageVersion) pivots.
 */

export const GRAPH_INIT_CYPHER = [
  // Ensure indices for rapid lookups
  `CREATE INDEX FOR (p:Portfolio) ON (p.id);`,
  `CREATE INDEX FOR (r:Repository) ON (r.id);`,
  `CREATE INDEX FOR (s:Snapshot) ON (s.id);`,
  `CREATE INDEX FOR (i:Installation) ON (i.id);`,
  `CREATE INDEX FOR (i:Installation) ON (i.snapshotId);`,
  `CREATE INDEX FOR (pv:PackageVersion) ON (pv.id);`,
  `CREATE INDEX FOR (v:Vulnerability) ON (v.id);`,
];

export const CYPHER_QUERIES = {
  // Ensure or get default portfolio
  GET_OR_CREATE_PORTFOLIO: `
    MERGE (p:Portfolio { id: $portfolioId })
    ON CREATE SET p.name = $portfolioName, p.createdAt = $createdAt
    RETURN p.id as id, p.name as name, p.createdAt as createdAt
  `,

  // Link repository to portfolio
  MERGE_REPOSITORY: `
    MATCH (p:Portfolio { id: $portfolioId })
    MERGE (r:Repository { id: $repositoryId })
    ON CREATE SET 
      r.url = $url, 
      r.name = $name, 
      r.owner = $owner, 
      r.defaultBranch = $defaultBranch, 
      r.createdAt = $createdAt
    MERGE (p)-[:CONTAINS]->(r)
    RETURN r.id as id, r.name as name, r.url as url
  `,

  // Create snapshot and root installation
  CREATE_SNAPSHOT: `
    MATCH (r:Repository { id: $repositoryId })
    CREATE (s:Snapshot {
      id: $snapshotId,
      repositoryId: $repositoryId,
      commitSha: $commitSha,
      createdAt: $createdAt,
      lockfileVersion: $lockfileVersion,
      totalPackages: $totalPackages,
      directCount: $directCount,
      transitiveCount: $transitiveCount,
      status: $status,
      errorMessage: $errorMessage
    })
    CREATE (r)-[:HAS_SNAPSHOT]->(s)
    CREATE (root:Installation {
      id: $rootInstallationId,
      snapshotId: $snapshotId,
      packagePath: "root",
      name: $rootName,
      version: $rootVersion,
      isDev: false,
      isDirect: false,
      depth: 0
    })
    CREATE (s)-[:HAS_ROOT]->(root)
    RETURN s.id as snapshotId, root.id as rootId
  `,

  // Batch insert package versions
  MERGE_PACKAGE_VERSIONS: `
    UNWIND $versions AS v
    MERGE (pv:PackageVersion { id: v.id })
    ON CREATE SET pv.name = v.name, pv.version = v.version
  `,

  // Batch insert installations scoped to snapshot
  CREATE_INSTALLATIONS: `
    UNWIND $installations AS inst
    CREATE (i:Installation {
      id: inst.id,
      snapshotId: inst.snapshotId,
      packagePath: inst.packagePath,
      name: inst.name,
      version: inst.version,
      isDev: inst.isDev,
      isDirect: inst.isDirect,
      depth: inst.depth
    })
    WITH i, inst
    MATCH (pv:PackageVersion { id: inst.packageVersionId })
    CREATE (i)-[:INSTANCE_OF]->(pv)
  `,

  // Batch create dependency edges
  CREATE_DEPENDENCY_EDGES: `
    UNWIND $edges AS edge
    MATCH (from:Installation { id: edge.fromId })
    MATCH (to:Installation { id: edge.toId })
    CREATE (from)-[:DEPENDS_ON { type: edge.type }]->(to)
  `,

  // Connect root to direct dependencies
  CONNECT_ROOT_DIRECT: `
    MATCH (root:Installation { id: $rootId })
    MATCH (child:Installation { snapshotId: $snapshotId, isDirect: true })
    WHERE child.id <> root.id
    MERGE (root)-[:DEPENDS_ON { type: 'prod' }]->(child)
  `,

  // Query: What packages are installed in this repository snapshot?
  // Direct indexed lookup on Installation.snapshotId, excluding root
  GET_SNAPSHOT_PACKAGES: `
    MATCH (i:Installation { snapshotId: $snapshotId })
    WHERE i.packagePath <> 'root'
    RETURN 
      i.id as id,
      i.snapshotId as snapshotId,
      i.packagePath as packagePath,
      i.name as name,
      i.version as version,
      i.isDev as isDev,
      i.isDirect as isDirect,
      i.depth as depth
    ORDER BY i.name ASC
  `,

  // Query: Why does this package exist? (Ordered path from repository root to installation)
  GET_DEPENDENCY_PATH: `
    MATCH (s:Snapshot { id: $snapshotId })-[:HAS_ROOT]->(root:Installation)
    MATCH (target:Installation { id: $installationId })
    WITH shortestPath((root)-[:DEPENDS_ON*1..15]->(target)) AS p
    RETURN [n IN nodes(p) | {
      id: n.id,
      name: n.name,
      version: n.version,
      isDirect: n.isDirect,
      packagePath: n.packagePath,
      depth: n.depth
    }] as chain
  `,

  // Query: Does another imported repository use the same package version?
  // Uses shared PackageVersion pivot and direct snapshotId index without backward path traversals
  GET_CROSS_REPO_SHARING: `
    MATCH (target:Installation { id: $installationId })-[:INSTANCE_OF]->(pv:PackageVersion)
    MATCH (otherI:Installation)-[:INSTANCE_OF]->(pv)
    WHERE otherI.snapshotId <> $snapshotId
    MATCH (otherS:Snapshot { id: otherI.snapshotId })<-[:HAS_SNAPSHOT]-(otherR:Repository)
    WHERE otherS.status = 'SUCCESS'
    RETURN DISTINCT
      otherR.id as repoId,
      otherR.name as repoName,
      otherR.url as repoUrl,
      otherS.id as snapshotId,
      otherI.isDirect as isDirect
    ORDER BY otherR.name ASC
  `,

  // Query: List repositories in portfolio with their latest snapshot
  LIST_REPOSITORIES: `
    MATCH (p:Portfolio { id: $portfolioId })-[:CONTAINS]->(r:Repository)
    OPTIONAL MATCH (r)-[:HAS_SNAPSHOT]->(s:Snapshot)
    WITH r, s ORDER BY s.createdAt DESC
    WITH r, collect(s) as snapshots
    RETURN 
      r.id as id,
      r.url as url,
      r.name as name,
      r.owner as owner,
      r.defaultBranch as defaultBranch,
      r.createdAt as createdAt,
      head(snapshots) as latestSnapshot,
      size(snapshots) as snapshotsCount
    ORDER BY r.name ASC
  `,

  // Batch insert vulnerability advisory nodes
  MERGE_VULNERABILITIES: `
    UNWIND $vulns AS v
    MERGE (vuln:Vulnerability { id: v.id })
    ON CREATE SET 
      vuln.cveId = v.cveId,
      vuln.summary = v.summary,
      vuln.details = v.details,
      vuln.severity = v.severity,
      vuln.fixedVersion = v.fixedVersion,
      vuln.url = v.url,
      vuln.publishedAt = v.publishedAt,
      vuln.modifiedAt = v.modifiedAt
  `,

  // Batch create [:AFFECTED_BY] edges from PackageVersion to Vulnerability
  LINK_PACKAGE_VULNERABILITIES: `
    UNWIND $links AS link
    MATCH (pv:PackageVersion { id: link.packageVersionId })
    MATCH (v:Vulnerability { id: link.vulnerabilityId })
    MERGE (pv)-[:AFFECTED_BY]->(v)
  `,

  // Query: Get all vulnerable installations in a repository snapshot with their advisory details
  GET_VULNERABLE_PACKAGES_IN_SNAPSHOT: `
    MATCH (s:Snapshot { id: $snapshotId })
    MATCH (i:Installation { snapshotId: s.id })-[:INSTANCE_OF]->(pv:PackageVersion)-[:AFFECTED_BY]->(v:Vulnerability)
    RETURN DISTINCT
      i.id as installationId,
      i.packagePath as packagePath,
      i.name as name,
      i.version as version,
      i.isDirect as isDirect,
      i.depth as depth,
      v.id as vulnId,
      v.cveId as cveId,
      v.summary as summary,
      v.severity as severity,
      v.fixedVersion as fixedVersion,
      v.url as url
    ORDER BY v.severity DESC, i.name ASC
  `,

  // Query: Find vulnerabilities that affect multiple repositories across the portfolio (Shared Blast Radius)
  GET_SHARED_VULNERABILITIES: `
    MATCH (p:Portfolio { id: $portfolioId })-[:CONTAINS]->(r:Repository)-[:HAS_SNAPSHOT]->(s:Snapshot)
    WHERE s.status = 'SUCCESS'
    MATCH (i:Installation { snapshotId: s.id })-[:INSTANCE_OF]->(pv:PackageVersion)-[:AFFECTED_BY]->(v:Vulnerability)
    WITH v, pv, r, s, i
    WITH v, pv.name as packageName, collect(DISTINCT pv.version) as versions, collect(DISTINCT {
      repoId: r.id,
      repoName: r.name,
      repoUrl: r.url,
      snapshotId: s.id,
      installationPath: i.packagePath,
      isDirect: i.isDirect
    }) as occurrences
    WHERE size(occurrences) > 1
    RETURN 
      v.id as vulnId,
      v.cveId as cveId,
      v.summary as summary,
      v.severity as severity,
      v.fixedVersion as fixedVersion,
      v.url as url,
      packageName,
      versions,
      occurrences,
      size(occurrences) as totalAffectedRepos
    ORDER BY size(occurrences) DESC, v.severity DESC
  `,

  // Query: All vulnerable instances across portfolio
  GET_ALL_VULNERABILITIES_IN_PORTFOLIO: `
    MATCH (p:Portfolio { id: $portfolioId })-[:CONTAINS]->(r:Repository)-[:HAS_SNAPSHOT]->(s:Snapshot)
    WHERE s.status = 'SUCCESS'
    MATCH (i:Installation { snapshotId: s.id })-[:INSTANCE_OF]->(pv:PackageVersion)-[:AFFECTED_BY]->(v:Vulnerability)
    RETURN DISTINCT
      v.id as vulnId,
      v.cveId as cveId,
      v.summary as summary,
      v.severity as severity,
      v.fixedVersion as fixedVersion,
      v.url as url,
      pv.name as packageName,
      pv.version as version,
      r.id as repoId,
      r.name as repoName,
      r.url as repoUrl,
      s.id as snapshotId,
      i.id as installationId,
      i.isDirect as isDirect,
      i.packagePath as packagePath,
      i.depth as depth
    ORDER BY v.severity DESC, r.name ASC
  `
};

import { getFalkorDriver } from '../falkordb/client.ts';
import { CYPHER_QUERIES } from './schema.ts';
import type { 
  InstallationNode, 
  InvestigationResult, 
  RepositorySummary, 
  RepositoryNode,
  SnapshotNode,
  DependencyPathItem,
  CrossRepoSharing,
  VulnerabilityNode
} from '../../types/index.ts';

/**
 * Normalizes raw Cypher results or in-memory graph objects into the RepositorySummary contract:
 * - Wraps flat repository fields inside `repository: RepositoryNode`
 * - Extracts `latestSnapshot.properties` into a plain `SnapshotNode`, preserving string ID
 * - Handles null snapshots
 * - Preserves snapshotsCount as a number
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRepositorySummary(raw: any): RepositorySummary {
  if (!raw) {
    throw new Error('Cannot normalize null or undefined repository summary');
  }

  // 1. Wrap flat repository fields inside repository
  const repoRaw = raw.repository || raw;
  const repository: RepositoryNode = {
    id: String(repoRaw.id || raw.id || ''),
    url: String(repoRaw.url || raw.url || ''),
    name: String(repoRaw.name || raw.name || ''),
    owner: String(repoRaw.owner || raw.owner || ''),
    defaultBranch: String(repoRaw.defaultBranch || raw.defaultBranch || 'main'),
    createdAt: String(repoRaw.createdAt || raw.createdAt || new Date().toISOString())
  };

  // 2. Extract latestSnapshot.properties into a plain SnapshotNode, preserving its string ID
  let latestSnapshot: SnapshotNode | null = null;
  const rawSnap = raw.latestSnapshot;
  if (rawSnap) {
    // In FalkorDB Cypher, node instances wrap properties under .properties
    const props = (typeof rawSnap === 'object' && 'properties' in rawSnap && rawSnap.properties)
      ? rawSnap.properties
      : rawSnap;

    if (props && props.id) {
      latestSnapshot = {
        id: String(props.id), // String ID: "snap:..." (preserves string ID, NOT numeric internal id)
        repositoryId: String(props.repositoryId || repository.id),
        commitSha: props.commitSha ? String(props.commitSha) : undefined,
        createdAt: String(props.createdAt || repository.createdAt),
        lockfileVersion: Number(props.lockfileVersion || 3),
        totalPackages: Number(props.totalPackages || 0),
        directCount: Number(props.directCount || 0),
        transitiveCount: Number(props.transitiveCount || 0),
        status: (props.status as 'SUCCESS' | 'FAILED') || 'SUCCESS',
        errorMessage: props.errorMessage ? String(props.errorMessage) : undefined
      };
    }
  }

  // 3. Preserve snapshotsCount as a number
  const snapshotsCount = typeof raw.snapshotsCount === 'number'
    ? raw.snapshotsCount
    : (Number(raw.snapshotsCount) || (latestSnapshot ? 1 : 0));

  return {
    repository,
    latestSnapshot,
    snapshotsCount
  };
}

/**
 * List all repositories in a portfolio with their latest snapshot
 */
export async function listRepositories(portfolioId = 'default'): Promise<RepositorySummary[]> {
  const driver = await getFalkorDriver();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await driver.query<any>(CYPHER_QUERIES.LIST_REPOSITORIES, { portfolioId });
  const records = res.data || [];
  return records.map(normalizeRepositorySummary);
}

/**
 * Get all installed packages in a snapshot, optionally filtered by name
 */
export async function getSnapshotPackages(snapshotId: string, search = ''): Promise<InstallationNode[]> {
  const driver = await getFalkorDriver();
  const res = await driver.query<InstallationNode>(CYPHER_QUERIES.GET_SNAPSHOT_PACKAGES, { snapshotId });
  let packages = res.data;

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    packages = packages.filter(p => p.name.toLowerCase().includes(q) || p.version.includes(q));
  }

  return packages;
}

/**
 * Deep investigation of an installed package:
 * - Traces ordered shortest path from root to installation
 * - Identifies the introducing direct dependency
 * - Queries cross-repository version sharing
 */
export async function investigatePackage(snapshotId: string, installationId: string): Promise<InvestigationResult> {
  const driver = await getFalkorDriver();

  // 1. Get package details (fast direct index lookup on installation ID)
  const targetRes = await driver.query<InstallationNode>(`
    MATCH (i:Installation { id: $installationId })
    RETURN 
      i.id as id,
      i.snapshotId as snapshotId,
      i.packagePath as packagePath,
      i.name as name,
      i.version as version,
      i.isDev as isDev,
      i.isDirect as isDirect,
      i.depth as depth
  `, { installationId });

  let target: InstallationNode | undefined = targetRes.data[0];
  if (!target || target.snapshotId !== snapshotId) {
    const packagesRes = await driver.query<InstallationNode>(CYPHER_QUERIES.GET_SNAPSHOT_PACKAGES, { snapshotId });
    target = packagesRes.data.find(p => p.id === installationId);
  }

  if (!target) {
    throw new Error(`Package installation ${installationId} not found in snapshot ${snapshotId}`);
  }

  // 2. Query dependency path from root
  const pathRes = await driver.query<{ chain: DependencyPathItem[] }>(CYPHER_QUERIES.GET_DEPENDENCY_PATH, {
    snapshotId,
    installationId
  });

  const chain = (pathRes.data[0]?.chain) || [
    {
      id: target.id,
      name: target.name,
      version: target.version,
      isDirect: target.isDirect,
      packagePath: target.packagePath,
      depth: target.depth
    }
  ];

  // 3. Find introducing direct dependency
  // In the chain: root is index 0. The direct dependency is at index 1 (if transitive) or index 0 if target itself is direct
  let introducingDirectDep: DependencyPathItem | null = null;
  if (target.isDirect) {
    introducingDirectDep = chain[chain.length - 1];
  } else if (chain.length > 1) {
    // The first hop after root (or the node marked isDirect)
    introducingDirectDep = chain.slice(1).find(item => item.isDirect) || chain[1];
  }

  // 4. Query cross-repository presence
  const sharingRes = await driver.query<CrossRepoSharing>(CYPHER_QUERIES.GET_CROSS_REPO_SHARING, {
    snapshotId,
    installationId
  });

  // 5. Query attached vulnerabilities
  let vulnerabilities: VulnerabilityNode[] = [];
  try {
    const vulnRes = await driver.query<VulnerabilityNode>(`
      MATCH (target:Installation { id: $installationId })-[:INSTANCE_OF]->(pv:PackageVersion)-[:AFFECTED_BY]->(v:Vulnerability)
      RETURN DISTINCT
        v.id as id,
        v.cveId as cveId,
        v.summary as summary,
        v.details as details,
        v.severity as severity,
        v.fixedVersion as fixedVersion,
        v.url as url
      ORDER BY v.severity DESC
    `, { installationId });
    vulnerabilities = vulnRes.data || [];
  } catch (vulnErr) {
    console.warn(`[Queries] Vulnerability lookup note:`, vulnErr);
  }

  return {
    target,
    path: chain,
    introducingDirectDep,
    sharedInRepositories: sharingRes.data || [],
    vulnerabilities
  };
}

/**
 * System status check
 */
export async function getSystemStatus() {
  const driver = await getFalkorDriver();
  const conn = driver.getConnectionStatus();

  if (!conn.connected) {
    return {
      connected: false,
      engineType: conn.type,
      details: conn.details,
      totalRepositories: 0,
      activePortfolio: 'default'
    };
  }

  const repos = await listRepositories('default');
  
  return {
    connected: conn.connected,
    engineType: conn.type,
    details: conn.details,
    totalRepositories: repos.length,
    activePortfolio: 'default'
  };
}

/**
 * Get vulnerable installations in a specific repository snapshot
 */
export async function getVulnerablePackagesInSnapshot(snapshotId: string) {
  const driver = await getFalkorDriver();
  const res = await driver.query(CYPHER_QUERIES.GET_VULNERABLE_PACKAGES_IN_SNAPSHOT, { snapshotId });
  return res.data;
}

/**
 * Query cross-repository shared vulnerabilities (blast radius)
 */
export async function getSharedVulnerabilities(portfolioId = 'default') {
  const driver = await getFalkorDriver();
  const res = await driver.query(CYPHER_QUERIES.GET_SHARED_VULNERABILITIES, { portfolioId });
  return res.data;
}

/**
 * Query all vulnerabilities across all repositories in portfolio
 */
export async function getAllPortfolioVulnerabilities(portfolioId = 'default') {
  const driver = await getFalkorDriver();
  const res = await driver.query(CYPHER_QUERIES.GET_ALL_VULNERABILITIES_IN_PORTFOLIO, { portfolioId });
  return res.data;
}


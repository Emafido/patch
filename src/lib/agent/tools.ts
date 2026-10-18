import { getFalkorDriver } from '../falkordb/client.ts';
import { CYPHER_QUERIES } from '../graph/schema.ts';
import type { 
  SharedVulnerabilityGroup, 
  RemediationCandidate, 
  DependencyPathItem,
  VulnerabilitySeverity
} from '../../types/index.ts';

/**
 * Tool 1: findSharedVulnerabilities
 * Discovers vulnerabilities that span across multiple repositories in the portfolio.
 */
export async function findSharedVulnerabilities(portfolioId = 'default'): Promise<SharedVulnerabilityGroup[]> {
  const driver = await getFalkorDriver();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await driver.query<any>(CYPHER_QUERIES.GET_SHARED_VULNERABILITIES, { portfolioId });
  const rawList = res.data || [];
  
  return rawList.map(row => ({
    vulnerability: {
      id: row.vulnId,
      cveId: row.cveId,
      summary: row.summary,
      severity: row.severity,
      fixedVersion: row.fixedVersion,
      url: row.url
    },
    affectedPackageName: row.packageName,
    affectedVersions: row.versions || [],
    affectedRepositories: row.occurrences || [],
    totalAffectedRepos: row.totalAffectedRepos || (row.occurrences ? row.occurrences.length : 0)
  }));
}

export interface VulnerablePathTrace {
  advisoryId: string;
  cveId?: string;
  severity: VulnerabilitySeverity;
  packageName: string;
  version: string;
  repoId: string;
  repoName: string;
  snapshotId: string;
  installationPath: string;
  isDirect: boolean;
  chain: DependencyPathItem[];
  introducingDirectDep: DependencyPathItem | null;
}

/**
 * Tool 2: traceVulnerableDependencyPaths
 * Traces the exact shortest graph paths from repository root to each vulnerable package instance.
 */
export async function traceVulnerableDependencyPaths(
  portfolioId = 'default',
  filterAdvisoryId?: string
): Promise<VulnerablePathTrace[]> {
  const driver = await getFalkorDriver();

  // 1. Get all vulnerable package instances in the portfolio
  const allVulnsRes = await driver.query<{
    vulnId: string;
    cveId?: string;
    summary: string;
    severity: VulnerabilitySeverity;
    fixedVersion?: string;
    url: string;
    packageName: string;
    version: string;
    repoId: string;
    repoName: string;
    repoUrl: string;
    snapshotId: string;
    installationId: string;
    isDirect: boolean;
    packagePath: string;
    depth: number;
  }>(CYPHER_QUERIES.GET_ALL_VULNERABILITIES_IN_PORTFOLIO, { portfolioId });

  let items = allVulnsRes.data || [];
  if (filterAdvisoryId) {
    items = items.filter(i => i.vulnId === filterAdvisoryId || i.cveId === filterAdvisoryId);
  }

  // Limit tracing to top 25 to protect response performance
  items = items.slice(0, 25);

  const traces: VulnerablePathTrace[] = [];

  for (const item of items) {
    try {
      const pathRes = await driver.query<{ chain: DependencyPathItem[] }>(
        CYPHER_QUERIES.GET_DEPENDENCY_PATH,
        {
          snapshotId: item.snapshotId,
          installationId: item.installationId
        }
      );

      const chain = pathRes.data[0]?.chain || [
        {
          id: item.installationId,
          name: item.packageName,
          version: item.version,
          isDirect: item.isDirect,
          packagePath: item.packagePath,
          depth: item.depth
        }
      ];

      let introducingDirectDep: DependencyPathItem | null = null;
      if (item.isDirect) {
        introducingDirectDep = chain[chain.length - 1];
      } else if (chain.length > 1) {
        introducingDirectDep = chain.slice(1).find(c => c.isDirect) || chain[1];
      }

      traces.push({
        advisoryId: item.vulnId,
        cveId: item.cveId,
        severity: item.severity,
        packageName: item.packageName,
        version: item.version,
        repoId: item.repoId,
        repoName: item.repoName,
        snapshotId: item.snapshotId,
        installationPath: item.packagePath,
        isDirect: item.isDirect,
        chain,
        introducingDirectDep
      });
    } catch (err) {
      console.warn(`[Agent Tools] Path trace error for ${item.packageName}:`, err);
    }
  }

  return traces;
}

/**
 * Tool 3: rankRemediationCandidates
 * Explicit heuristic ranking evaluating:
 * - Number of affected repositories in the portfolio
 * - Severity score
 * - Proximity to direct dependencies
 * - Actionable fixed versions
 * 
 * Crucial Safeguards:
 * - Explicitly notes that dependency reachability does not guarantee runtime exploitability.
 * - Does not claim automated upgrades are verified without CI.
 */
export async function rankRemediationCandidates(portfolioId = 'default'): Promise<RemediationCandidate[]> {
  const driver = await getFalkorDriver();

  const allVulnsRes = await driver.query<{
    vulnId: string;
    cveId?: string;
    summary: string;
    severity: VulnerabilitySeverity;
    fixedVersion?: string;
    url: string;
    packageName: string;
    version: string;
    repoId: string;
    repoName: string;
    snapshotId: string;
    installationId: string;
    isDirect: boolean;
    depth: number;
  }>(CYPHER_QUERIES.GET_ALL_VULNERABILITIES_IN_PORTFOLIO, { portfolioId });

  const raw = allVulnsRes.data || [];
  if (raw.length === 0) return [];

  // Group by advisory ID
  const groups = new Map<string, {
    advisoryId: string;
    cveId?: string;
    packageName: string;
    severity: VulnerabilitySeverity;
    fixedVersion?: string;
    repos: Set<string>;
    isDirect: boolean;
    minDepth: number;
    introducingDirectDeps: Set<string>;
  }>();

  for (const item of raw) {
    let group = groups.get(item.vulnId);
    if (!group) {
      group = {
        advisoryId: item.vulnId,
        cveId: item.cveId,
        packageName: item.packageName,
        severity: item.severity,
        fixedVersion: item.fixedVersion,
        repos: new Set<string>(),
        isDirect: false,
        minDepth: 99,
        introducingDirectDeps: new Set<string>()
      };
      groups.set(item.vulnId, group);
    }

    group.repos.add(item.repoName);
    if (item.isDirect) group.isDirect = true;
    if (item.depth < group.minDepth) group.minDepth = item.depth;

    if (item.isDirect) {
      group.introducingDirectDeps.add(item.packageName);
    }
  }

  const severityWeights: Record<VulnerabilitySeverity, number> = {
    CRITICAL: 30,
    HIGH: 20,
    MODERATE: 10,
    LOW: 4,
    UNKNOWN: 2
  };

  const candidates: Array<RemediationCandidate & { score: number }> = [];

  for (const group of groups.values()) {
    const affectedCount = group.repos.size;
    const sevScore = severityWeights[group.severity] || 2;
    const directBonus = group.isDirect ? 10 : 0;
    const score = (affectedCount * 25) + sevScore + directBonus - Math.min(group.minDepth * 2, 10);

    const recommendedAction = group.fixedVersion
      ? `Upgrade ${group.packageName} to version >= ${group.fixedVersion} (check introducing direct dependencies).`
      : `No direct upstream patch recorded. Investigate alternatives or pin overrides.`;

    candidates.push({
      rank: 0, // assigned after sorting
      advisoryId: group.advisoryId,
      cveId: group.cveId,
      packageName: group.packageName,
      severity: group.severity,
      affectedRepositoriesCount: affectedCount,
      affectedRepositories: Array.from(group.repos),
      minDepth: group.minDepth === 99 ? 1 : group.minDepth,
      isDirectInAnyRepo: group.isDirect,
      introducingDirectDeps: Array.from(group.introducingDirectDeps),
      recommendedAction,
      uncertainties: [
        'Reachability in dependency graph does not confirm runtime execution/exploitability.',
        'Upgrading parent direct dependencies may introduce breaking API changes.',
        'Semver peer-dependency constraints may require coordinated multi-package updates.'
      ],
      verificationSteps: [
        `1. Inspect package.json in ${Array.from(group.repos).join(', ')} for direct dependencies pulling ${group.packageName}.`,
        `2. Apply candidate version bump in a clean branch.`,
        `3. Run \`npm audit\` and test suite to confirm vulnerability elimination and build integrity.`
      ],
      score
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  return candidates.map((c, idx) => ({
    rank: idx + 1,
    advisoryId: c.advisoryId,
    cveId: c.cveId,
    packageName: c.packageName,
    severity: c.severity,
    affectedRepositoriesCount: c.affectedRepositoriesCount,
    affectedRepositories: c.affectedRepositories,
    minDepth: c.minDepth,
    isDirectInAnyRepo: c.isDirectInAnyRepo,
    introducingDirectDeps: c.introducingDirectDeps,
    recommendedAction: c.recommendedAction,
    uncertainties: c.uncertainties,
    verificationSteps: c.verificationSteps
  }));
}

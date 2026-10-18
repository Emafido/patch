import type { 
  PortfolioNode, 
  RepositoryNode, 
  SnapshotNode, 
  InstallationNode, 
  PackageVersionNode,
  DependencyPathItem,
  CrossRepoSharing 
} from '../../types/index.ts';
import type { FalkorDriver, QueryResult } from './types.ts';

export class InMemoryGraphEngine implements FalkorDriver {
  private portfolios = new Map<string, PortfolioNode>();
  private repositories = new Map<string, RepositoryNode>();
  private snapshots = new Map<string, SnapshotNode>();
  private installations = new Map<string, InstallationNode>();
  private packageVersions = new Map<string, PackageVersionNode>();

  // Relationships
  private portfolioRepos = new Map<string, Set<string>>(); // portfolioId -> Set<repoId>
  private repoSnapshots = new Map<string, Set<string>>(); // repoId -> Set<snapshotId>
  private snapshotRoots = new Map<string, string>(); // snapshotId -> rootInstallationId
  private dependsOn = new Map<string, Map<string, string>>(); // fromInstId -> Map<toInstId, type>
  private instanceOf = new Map<string, string>(); // instId -> packageVersionId

  constructor() {
    // Initialize default portfolio
    this.portfolios.set('default', {
      id: 'default',
      name: 'Default Portfolio',
      createdAt: new Date().toISOString()
    });
    this.portfolioRepos.set('default', new Set());
  }

  isMock(): boolean {
    return true;
  }

  getConnectionStatus(): { connected: boolean; type: 'FALKORDB_LIVE' | 'IN_MEMORY_GRAPH'; details: string } {
    return {
      connected: true,
      type: 'IN_MEMORY_GRAPH',
      details: 'In-Memory Graph Engine (Offline & Fast Traversal Mode)'
    };
  }

  async close(): Promise<void> {
    // No-op for in-memory
  }

  async query<T = Record<string, unknown>>(queryStr: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
    const trimmed = queryStr.trim();

    // 1. GET_OR_CREATE_PORTFOLIO
    if (trimmed.includes('MERGE (p:Portfolio')) {
      const id = String(params.portfolioId || 'default');
      let p = this.portfolios.get(id);
      if (!p) {
        p = {
          id,
          name: String(params.portfolioName || 'Default Portfolio'),
          createdAt: String(params.createdAt || new Date().toISOString())
        };
        this.portfolios.set(id, p);
        if (!this.portfolioRepos.has(id)) this.portfolioRepos.set(id, new Set());
      }
      return { data: [p as unknown as T] };
    }

    // 2. MERGE_REPOSITORY
    if (trimmed.includes('MERGE (r:Repository')) {
      const pId = String(params.portfolioId || 'default');
      const rId = String(params.repositoryId);
      let r = this.repositories.get(rId);
      if (!r) {
        r = {
          id: rId,
          url: String(params.url),
          name: String(params.name),
          owner: String(params.owner),
          defaultBranch: String(params.defaultBranch || 'main'),
          createdAt: String(params.createdAt || new Date().toISOString())
        };
        this.repositories.set(rId, r);
      }
      const set = this.portfolioRepos.get(pId) || new Set();
      set.add(rId);
      this.portfolioRepos.set(pId, set);
      return { data: [r as unknown as T] };
    }

    // 3. CREATE_SNAPSHOT
    if (trimmed.includes('CREATE (s:Snapshot')) {
      const sId = String(params.snapshotId);
      const rId = String(params.repositoryId);
      const rootId = String(params.rootInstallationId);

      const snapshot: SnapshotNode = {
        id: sId,
        repositoryId: rId,
        commitSha: params.commitSha ? String(params.commitSha) : undefined,
        createdAt: String(params.createdAt || new Date().toISOString()),
        lockfileVersion: Number(params.lockfileVersion || 3),
        totalPackages: Number(params.totalPackages || 0),
        directCount: Number(params.directCount || 0),
        transitiveCount: Number(params.transitiveCount || 0),
        status: (params.status as 'SUCCESS' | 'FAILED') || 'SUCCESS',
        errorMessage: params.errorMessage ? String(params.errorMessage) : undefined
      };
      this.snapshots.set(sId, snapshot);

      const rSet = this.repoSnapshots.get(rId) || new Set();
      rSet.add(sId);
      this.repoSnapshots.set(rId, rSet);

      // Root installation
      const rootInst: InstallationNode = {
        id: rootId,
        snapshotId: sId,
        packagePath: 'root',
        name: String(params.rootName || 'root'),
        version: String(params.rootVersion || '1.0.0'),
        isDev: false,
        isDirect: false,
        depth: 0
      };
      this.installations.set(rootId, rootInst);
      this.snapshotRoots.set(sId, rootId);

      return { data: [{ snapshotId: sId, rootId } as unknown as T] };
    }

    // 4. MERGE_PACKAGE_VERSIONS
    if (trimmed.includes('UNWIND $versions AS v')) {
      const versions = (params.versions as Array<{ id: string; name: string; version: string }>) || [];
      for (const v of versions) {
        if (!this.packageVersions.has(v.id)) {
          this.packageVersions.set(v.id, { id: v.id, name: v.name, version: v.version });
        }
      }
      return { data: [] };
    }

    // 5. CREATE_INSTALLATIONS
    if (trimmed.includes('UNWIND $installations AS inst')) {
      const insts = (params.installations as Array<{
        id: string;
        snapshotId: string;
        packagePath: string;
        name: string;
        version: string;
        isDev: boolean;
        isDirect: boolean;
        depth: number;
        packageVersionId: string;
      }>) || [];

      for (const item of insts) {
        const node: InstallationNode = {
          id: item.id,
          snapshotId: item.snapshotId,
          packagePath: item.packagePath,
          name: item.name,
          version: item.version,
          isDev: item.isDev,
          isDirect: item.isDirect,
          depth: item.depth
        };
        this.installations.set(item.id, node);
        this.instanceOf.set(item.id, item.packageVersionId);
      }
      return { data: [] };
    }

    // 6. CREATE_DEPENDENCY_EDGES
    if (trimmed.includes('UNWIND $edges AS edge')) {
      const edges = (params.edges as Array<{ fromId: string; toId: string; type: string }>) || [];
      for (const e of edges) {
        let childMap = this.dependsOn.get(e.fromId);
        if (!childMap) {
          childMap = new Map();
          this.dependsOn.set(e.fromId, childMap);
        }
        childMap.set(e.toId, e.type);
      }
      return { data: [] };
    }

    // 7. CONNECT_ROOT_DIRECT
    if (trimmed.includes('MATCH (root:Installation { id: $rootId })')) {
      const rootId = String(params.rootId);
      const snapshotId = String(params.snapshotId);
      let childMap = this.dependsOn.get(rootId);
      if (!childMap) {
        childMap = new Map();
        this.dependsOn.set(rootId, childMap);
      }
      for (const inst of this.installations.values()) {
        if (inst.snapshotId === snapshotId && inst.isDirect && inst.id !== rootId) {
          childMap.set(inst.id, 'prod');
        }
      }
      return { data: [] };
    }

    // 8. GET_DEPENDENCY_PATH (check shortestPath first before general snapshot root pattern)
    if (trimmed.includes('shortestPath')) {
      const snapshotId = String(params.snapshotId);
      const targetId = String(params.installationId);
      const rootId = this.snapshotRoots.get(snapshotId);
      if (!rootId) return { data: [] };

      const path = this.findShortestPath(rootId, targetId, snapshotId);
      if (!path) return { data: [] };

      const chain: DependencyPathItem[] = path.map(id => {
        const inst = this.installations.get(id)!;
        return {
          id: inst.id,
          name: inst.name,
          version: inst.version,
          isDirect: inst.isDirect,
          packagePath: inst.packagePath,
          depth: inst.depth
        };
      });

      return { data: [{ chain }] as unknown as T[] };
    }

    // 9. Single installation lookup by ID
    if (trimmed.includes('MATCH (i:Installation { id: $installationId })')) {
      const instId = String(params.installationId);
      const inst = this.installations.get(instId);
      return { data: (inst ? [inst] : []) as unknown as T[] };
    }

    // 10. GET_SNAPSHOT_PACKAGES (direct snapshotId lookup excluding root)
    if (trimmed.includes('(i:Installation') && trimmed.includes('ORDER BY i.name')) {
      const snapshotId = String(params.snapshotId);
      const result: InstallationNode[] = [];

      for (const inst of this.installations.values()) {
        if (inst.snapshotId === snapshotId && inst.packagePath !== 'root') {
          result.push(inst);
        }
      }

      // Sort alphabetically by name
      result.sort((a, b) => a.name.localeCompare(b.name));
      return { data: result as unknown as T[] };
    }

    // 10. GET_CROSS_REPO_SHARING
    if (trimmed.includes('MATCH (target:Installation { id: $installationId })-[:INSTANCE_OF]->(pv:PackageVersion)')) {
      const targetId = String(params.installationId);
      const snapshotId = String(params.snapshotId);
      const pvId = this.instanceOf.get(targetId);
      if (!pvId) return { data: [] };

      const sharings: CrossRepoSharing[] = [];
      const seenRepos = new Set<string>();

      for (const [otherInstId, otherPvId] of this.instanceOf.entries()) {
        if (otherPvId === pvId && otherInstId !== targetId) {
          const otherInst = this.installations.get(otherInstId);
          if (otherInst && otherInst.snapshotId !== snapshotId) {
            const otherSnap = this.snapshots.get(otherInst.snapshotId);
            if (otherSnap && otherSnap.status === 'SUCCESS') {
              const otherRepo = this.repositories.get(otherSnap.repositoryId);
              if (otherRepo && !seenRepos.has(otherRepo.id)) {
                seenRepos.add(otherRepo.id);
                sharings.push({
                  repoId: otherRepo.id,
                  repoName: otherRepo.name,
                  repoUrl: otherRepo.url,
                  snapshotId: otherSnap.id,
                  isDirect: otherInst.isDirect
                });
              }
            }
          }
        }
      }

      sharings.sort((a, b) => a.repoName.localeCompare(b.repoName));
      return { data: sharings as unknown as T[] };
    }

    // 11. LIST_REPOSITORIES
    if (trimmed.includes('MATCH (p:Portfolio { id: $portfolioId })-[:CONTAINS]->(r:Repository)')) {
      const pId = String(params.portfolioId || 'default');
      const repoIds = this.portfolioRepos.get(pId) || new Set();
      const results: Array<Record<string, unknown>> = [];

      for (const rId of repoIds) {
        const repo = this.repositories.get(rId);
        if (repo) {
          const snapIds = Array.from(this.repoSnapshots.get(rId) || []);
          const snaps = snapIds
            .map(sId => this.snapshots.get(sId)!)
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          results.push({
            id: repo.id,
            url: repo.url,
            name: repo.name,
            owner: repo.owner,
            defaultBranch: repo.defaultBranch,
            createdAt: repo.createdAt,
            latestSnapshot: snaps[0] || null,
            snapshotsCount: snaps.length
          });
        }
      }

      results.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return { data: results as unknown as T[] };
    }

    // Fallback for unhandled query (e.g. index creations)
    return { data: [] };
  }

  private findShortestPath(startId: string, endId: string, snapshotId: string): string[] | null {
    if (startId === endId) return [startId];

    const visited = new Set<string>();
    const parentMap = new Map<string, string>();
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === endId) {
        const path = [endId];
        let curr = endId;
        while (parentMap.has(curr)) {
          curr = parentMap.get(curr)!;
          path.unshift(curr);
        }
        return path;
      }

      const children = this.dependsOn.get(current);
      if (children) {
        for (const childId of children.keys()) {
          const childInst = this.installations.get(childId);
          // Strictly enforce snapshot boundary
          if (childInst && childInst.snapshotId === snapshotId && !visited.has(childId)) {
            visited.add(childId);
            parentMap.set(childId, current);
            queue.push(childId);
          }
        }
      }
    }

    return null;
  }
}

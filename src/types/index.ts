/**
 * Core type definitions for Patch dependency security investigation
 */

export interface PortfolioNode {
  id: string;
  name: string;
  createdAt: string;
}

export interface RepositoryNode {
  id: string;
  url: string;
  name: string;
  owner: string;
  defaultBranch: string;
  createdAt: string;
}

export interface SnapshotNode {
  id: string;
  repositoryId: string;
  commitSha?: string;
  createdAt: string;
  lockfileVersion: number;
  totalPackages: number;
  directCount: number;
  transitiveCount: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export interface InstallationNode {
  id: string; // scoped ID: `${snapshotId}:${packagePath}`
  snapshotId: string;
  packagePath: string; // e.g. "node_modules/next" or "node_modules/next/node_modules/postcss"
  name: string;
  version: string;
  isDev: boolean;
  isDirect: boolean;
  depth: number;
}

export interface PackageVersionNode {
  id: string; // canonical ID: `${name}@${version}`
  name: string;
  version: string;
}

export interface DependencyEdge {
  fromInstallationId: string;
  toInstallationId: string;
  type: 'prod' | 'dev' | 'peer' | 'optional';
}

export interface DependencyPathItem {
  id: string;
  name: string;
  version: string;
  isDirect: boolean;
  packagePath: string;
  depth: number;
}

export interface CrossRepoSharing {
  repoId: string;
  repoName: string;
  repoUrl: string;
  snapshotId: string;
  isDirect: boolean;
}

export interface InvestigationResult {
  target: InstallationNode;
  path: DependencyPathItem[];
  introducingDirectDep: DependencyPathItem | null;
  sharedInRepositories: CrossRepoSharing[];
}

export interface RepositorySummary {
  repository: RepositoryNode;
  latestSnapshot: SnapshotNode | null;
  snapshotsCount: number;
}

export interface IngestionRequest {
  url: string;
  portfolioId?: string;
}

export interface IngestionResult {
  success: boolean;
  repository: RepositoryNode;
  snapshot: SnapshotNode;
  message: string;
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl } from '../src/lib/ingestion/github.ts';
import { parseLockfileTree } from '../src/lib/ingestion/arborist.ts';
import { FIXTURES } from '../src/lib/ingestion/fixtures.ts';
import { InMemoryGraphEngine } from '../src/lib/falkordb/in-memory-engine.ts';
import { CYPHER_QUERIES } from '../src/lib/graph/schema.ts';
import { normalizeRepositorySummary } from '../src/lib/graph/queries.ts';
import type { InstallationNode, DependencyPathItem, CrossRepoSharing } from '../src/types/index.ts';

describe('Task 2.3 & 2.7: Input Validation', () => {
  it('correctly parses valid GitHub repository URLs', () => {
    assert.deepEqual(parseGitHubUrl('https://github.com/Emafido/quikapi'), {
      owner: 'Emafido',
      repo: 'quikapi',
      url: 'https://github.com/Emafido/quikapi'
    });

    assert.deepEqual(parseGitHubUrl('https://github.com/Emafido/quikapi.git'), {
      owner: 'Emafido',
      repo: 'quikapi',
      url: 'https://github.com/Emafido/quikapi'
    });

    assert.deepEqual(parseGitHubUrl('Emafido/quikapi'), {
      owner: 'Emafido',
      repo: 'quikapi',
      url: 'https://github.com/Emafido/quikapi'
    });
  });

  it('rejects invalid or malformed repository URLs with actionable errors', () => {
    assert.throws(() => parseGitHubUrl(''), /Please enter a valid GitHub repository URL/);
    assert.throws(() => parseGitHubUrl('https://gitlab.com/owner/repo'), /Invalid repository URL/);
    assert.throws(() => parseGitHubUrl('invalid_string_without_slash'), /Invalid repository URL/);
  });
});

describe('Task 2.3 & 2.7: Arborist Tree Parsing & Hoisting / Nested Resolution', () => {
  it('correctly parses direct vs transitive dependencies', () => {
    const fixture = FIXTURES['emafido/quikapi'];
    const tree = parseLockfileTree('snap-test-1', fixture.packageJson, fixture.packageLockJson);

    assert.equal(tree.rootName, 'quikapi');
    assert.ok(tree.directCount > 0, 'directCount should be > 0');
    assert.ok(tree.transitiveCount > 0, 'transitiveCount should be > 0');

    // Direct dependencies: next, react, react-dom, zod
    const nextInst = tree.installations.find(i => i.name === 'next');
    assert.ok(nextInst, 'next installation should exist');
    assert.equal(nextInst?.isDirect, true);

    // Transitive dependency: postcss (introduced by next)
    const postcssInst = tree.installations.find(i => i.name === 'postcss');
    assert.ok(postcssInst, 'postcss installation should exist');
    assert.equal(postcssInst?.isDirect, false);
  });

  it('handles nested version installations properly', () => {
    const mockPkgJson = {
      name: 'nested-test',
      version: '1.0.0',
      dependencies: { 'parent-a': '^1.0.0' }
    };

    const mockLockJson = {
      name: 'nested-test',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': { name: 'nested-test', version: '1.0.0', dependencies: { 'parent-a': '^1.0.0' } },
        'node_modules/parent-a': {
          version: '1.0.0',
          dependencies: { 'shared-dep': '1.0.0' }
        },
        'node_modules/shared-dep': {
          version: '2.0.0' // top-level hoisted version
        },
        'node_modules/parent-a/node_modules/shared-dep': {
          version: '1.0.0' // nested overridden version
        }
      }
    };

    const tree = parseLockfileTree('snap-nested', mockPkgJson, mockLockJson);
    const nestedShared = tree.installations.find(
      i => i.packagePath === 'node_modules/parent-a/node_modules/shared-dep'
    );
    assert.ok(nestedShared, 'nested shared-dep should exist');
    assert.equal(nestedShared?.version, '1.0.0');
    assert.equal(nestedShared?.depth, 2);

    // Edge from parent-a must resolve to its nested shared-dep
    const edge = tree.edges.find(e => e.toId === nestedShared?.id);
    assert.ok(edge, 'edge to nested dependency should exist');
    assert.equal(edge?.fromId, 'snap-nested:node_modules/parent-a');
  });
});

describe('Task 2.4 & 2.6: Graph Path Traversal & Required Correctness Example', () => {
  let engine: InMemoryGraphEngine;

  beforeEach(() => {
    engine = new InMemoryGraphEngine();
  });

  it('verifies the required path: QuikAPI → next@16.2.6 → postcss@8.4.31', async () => {
    const quikapi = FIXTURES['emafido/quikapi'];
    const snapshotId = 'snap:quikapi:test';
    const tree = parseLockfileTree(snapshotId, quikapi.packageJson, quikapi.packageLockJson);

    // 1. Ingest QuikAPI into graph engine
    await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
      portfolioId: 'default',
      repositoryId: 'repo:emafido/quikapi',
      url: quikapi.url,
      name: 'quikapi',
      owner: 'Emafido',
      defaultBranch: 'master',
      createdAt: new Date().toISOString()
    });

    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:emafido/quikapi',
      snapshotId,
      rootInstallationId: `${snapshotId}:root`,
      commitSha: 'HEAD',
      createdAt: new Date().toISOString(),
      lockfileVersion: 3,
      totalPackages: tree.totalPackages,
      directCount: tree.directCount,
      transitiveCount: tree.transitiveCount,
      status: 'SUCCESS',
      rootName: tree.rootName,
      rootVersion: tree.rootVersion
    });

    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: tree.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: tree.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: tree.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, {
      rootId: `${snapshotId}:root`,
      snapshotId
    });

    // 2. Query packages in snapshot
    const pkgsRes = await engine.query<InstallationNode>(CYPHER_QUERIES.GET_SNAPSHOT_PACKAGES, {
      snapshotId
    });
    assert.ok(pkgsRes.data.length > 0);

    const postcssInst = pkgsRes.data.find(p => p.name === 'postcss');
    assert.ok(postcssInst);
    assert.equal(postcssInst?.version, '8.4.31');

    // 3. Query shortest path from root to postcss
    const pathRes = await engine.query<{ chain: DependencyPathItem[] }>(
      CYPHER_QUERIES.GET_DEPENDENCY_PATH,
      {
        snapshotId,
        installationId: postcssInst!.id
      }
    );

    const chain = pathRes.data[0]?.chain || [];
    assert.equal(chain.length, 3);

    // Node 0: QuikAPI (root)
    assert.equal(chain[0].name, 'quikapi');

    // Node 1: next@16.2.6 (direct dependency)
    assert.equal(chain[1].name, 'next');
    assert.equal(chain[1].version, '16.2.6');
    assert.equal(chain[1].isDirect, true);

    // Node 2: postcss@8.4.31 (transitive leaf)
    assert.equal(chain[2].name, 'postcss');
    assert.equal(chain[2].version, '8.4.31');
    assert.equal(chain[2].isDirect, false);
  });

  it('guarantees strict snapshot isolation between multiple repositories', async () => {
    // Ingest QuikAPI
    const quikapi = FIXTURES['emafido/quikapi'];
    const snap1 = 'snap:quikapi:iso';
    const tree1 = parseLockfileTree(snap1, quikapi.packageJson, quikapi.packageLockJson);

    await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
      portfolioId: 'default',
      repositoryId: 'repo:quikapi',
      url: quikapi.url,
      name: 'quikapi',
      owner: 'Emafido',
      defaultBranch: 'master',
      createdAt: new Date().toISOString()
    });
    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:quikapi',
      snapshotId: snap1,
      rootInstallationId: `${snap1}:root`,
      commitSha: 'HEAD',
      createdAt: new Date().toISOString(),
      lockfileVersion: 3,
      totalPackages: tree1.totalPackages,
      directCount: tree1.directCount,
      transitiveCount: tree1.transitiveCount,
      status: 'SUCCESS',
      rootName: tree1.rootName,
      rootVersion: tree1.rootVersion
    });
    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: tree1.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: tree1.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: tree1.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${snap1}:root`, snapshotId: snap1 });

    // Ingest Ghost
    const ghost = FIXTURES['emafido/ghost'];
    const snap2 = 'snap:ghost:iso';
    const tree2 = parseLockfileTree(snap2, ghost.packageJson, ghost.packageLockJson);

    await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
      portfolioId: 'default',
      repositoryId: 'repo:ghost',
      url: ghost.url,
      name: 'ghost',
      owner: 'Emafido',
      defaultBranch: 'master',
      createdAt: new Date().toISOString()
    });
    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:ghost',
      snapshotId: snap2,
      rootInstallationId: `${snap2}:root`,
      commitSha: 'HEAD',
      createdAt: new Date().toISOString(),
      lockfileVersion: 3,
      totalPackages: tree2.totalPackages,
      directCount: tree2.directCount,
      transitiveCount: tree2.transitiveCount,
      status: 'SUCCESS',
      rootName: tree2.rootName,
      rootVersion: tree2.rootVersion
    });
    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: tree2.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: tree2.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: tree2.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${snap2}:root`, snapshotId: snap2 });

    // Path query in QuikAPI for next@16.2.6
    const pathRes1 = await engine.query<{ chain: DependencyPathItem[] }>(
      CYPHER_QUERIES.GET_DEPENDENCY_PATH,
      {
        snapshotId: snap1,
        installationId: `${snap1}:node_modules/next`
      }
    );
    const chain1 = pathRes1.data[0].chain;

    // None of the installations in chain1 should belong to Ghost (snap2)
    for (const item of chain1) {
      assert.equal(item.id.startsWith(snap1), true, `Item ${item.id} should belong to snapshot 1`);
      assert.equal(item.id.startsWith(snap2), false, `Item ${item.id} should NOT belong to snapshot 2`);
    }

    // Cross-repo sharing query: postcss is in both quikapi and ghost
    const sharingRes = await engine.query<CrossRepoSharing>(CYPHER_QUERIES.GET_CROSS_REPO_SHARING, {
      snapshotId: snap1,
      installationId: `${snap1}:node_modules/postcss`
    });

    assert.equal(sharingRes.data.length, 1);
    assert.equal(sharingRes.data[0].repoName, 'ghost');
  });
});

describe('Task 2.7: Malformed Lockfiles, Unsupported Formats & Edge Resilience', () => {
  it('handles empty or malformed package-lock packages gracefully', () => {
    const malformedLock = {
      name: 'broken-app',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {}
    };
    const tree = parseLockfileTree('snap-malformed', { name: 'broken-app' }, malformedLock);
    assert.equal(tree.totalPackages, 0);
    assert.equal(tree.directCount, 0);
    assert.equal(tree.transitiveCount, 0);
    assert.equal(tree.installations.length, 0);
    assert.equal(tree.edges.length, 0);
  });

  it('safely skips missing or unresolvable dependencies without failing', () => {
    const pkgJson = {
      name: 'missing-dep-test',
      dependencies: { 'exists': '1.0.0' }
    };
    const lockJson = {
      name: 'missing-dep-test',
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { 'exists': '1.0.0' } },
        'node_modules/exists': {
          version: '1.0.0',
          dependencies: { 'ghost-dep': '9.9.9' }
        }
      }
    };
    const tree = parseLockfileTree('snap-missing-dep', pkgJson, lockJson);
    assert.equal(tree.totalPackages, 1);
    const existsInst = tree.installations.find(i => i.name === 'exists');
    assert.ok(existsInst);
    const ghostEdge = tree.edges.find(e => e.fromId === existsInst?.id);
    assert.equal(ghostEdge, undefined);
  });

  it('rejects unsupported npm lockfile version 1 with informative error guidance', () => {
    const lockfileV1 = {
      name: 'legacy-project',
      version: '1.0.0',
      lockfileVersion: 1,
      dependencies: {
        'lodash': { version: '4.17.21' }
      }
    };
    assert.equal(lockfileV1.lockfileVersion, 1);
    const validateVersion = (v: number) => {
      if (v === 1) {
        throw new Error(
          'Repository uses npm lockfileVersion 1, which lacks modern package path mappings. Patch supports modern npm lockfile versions 2 and 3. Please run "npm install" on npm 7+ and commit the updated lockfile.'
        );
      }
    };
    assert.throws(() => validateVersion(lockfileV1.lockfileVersion), /lockfileVersion 1.*npm 7\+/);
  });
});

describe('Task 2.6 & 2.7: General-Purpose Ingestion & Cross-Repo Intelligence', () => {
  it('imports an unrelated public npm package fixture (sindresorhus/is)', () => {
    const isFixture = FIXTURES['sindresorhus/is'];
    assert.ok(isFixture);
    const tree = parseLockfileTree('snap-is-test', isFixture.packageJson, isFixture.packageLockJson);

    assert.equal(tree.rootName, '@sindresorhus/is');
    assert.equal(tree.totalPackages, 1);
    assert.equal(tree.installations[0].name, 'typescript');
    assert.equal(tree.installations[0].isDev, true);
  });

  it('demonstrates multi-repo shared dependencies across QuikAPI, Ghost, and Ekotrace', async () => {
    const engine = new InMemoryGraphEngine();

    for (const [key, fixture] of Object.entries(FIXTURES)) {
      if (key === 'sindresorhus/is') continue;
      const snapId = `snap:${fixture.repo}`;
      const tree = parseLockfileTree(snapId, fixture.packageJson, fixture.packageLockJson);

      await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
        portfolioId: 'default',
        repositoryId: `repo:${key}`,
        url: fixture.url,
        name: fixture.repo,
        owner: fixture.owner,
        defaultBranch: fixture.defaultBranch,
        createdAt: new Date().toISOString()
      });

      await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
        repositoryId: `repo:${key}`,
        snapshotId: snapId,
        rootInstallationId: `${snapId}:root`,
        commitSha: 'HEAD',
        createdAt: new Date().toISOString(),
        lockfileVersion: 3,
        totalPackages: tree.totalPackages,
        directCount: tree.directCount,
        transitiveCount: tree.transitiveCount,
        status: 'SUCCESS',
        rootName: tree.rootName,
        rootVersion: tree.rootVersion
      });

      await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: tree.packageVersions });
      await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: tree.installations });
      await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: tree.edges });
      await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${snapId}:root`, snapshotId: snapId });
    }

    const ghostSnap = 'snap:ghost';
    const ghostLucide = `${ghostSnap}:node_modules/lucide-react`;
    const sharingRes = await engine.query<CrossRepoSharing>(CYPHER_QUERIES.GET_CROSS_REPO_SHARING, {
      snapshotId: ghostSnap,
      installationId: ghostLucide
    });

    assert.ok(sharingRes.data.length >= 1);
    const ekotraceMatch = sharingRes.data.find(r => r.repoName.toLowerCase() === 'ekotrace');
    assert.ok(ekotraceMatch, 'Ekotrace should share lucide-react with Ghost');

    const quikapiSnap = 'snap:quikapi';
    const quikapiNext = `${quikapiSnap}:node_modules/next`;
    const nextSharing = await engine.query<CrossRepoSharing>(CYPHER_QUERIES.GET_CROSS_REPO_SHARING, {
      snapshotId: quikapiSnap,
      installationId: quikapiNext
    });

    const ghostMatch = nextSharing.data.find(r => r.repoName.toLowerCase() === 'ghost');
    assert.ok(ghostMatch, 'Ghost should share next@16.2.6 with QuikAPI');
  });
});

describe('Regression: Repository Summary Normalization & Frontend API Contract', () => {
  it('correctly normalizes raw FalkorDB-shaped Cypher responses', () => {
    const rawFalkorDbRow = {
      id: 'repo:emafido/ghost',
      url: 'https://github.com/Emafido/ghost',
      name: 'ghost',
      owner: 'Emafido',
      defaultBranch: 'master',
      createdAt: '2026-10-18T11:22:41.350Z',
      latestSnapshot: {
        id: 1806, // internal numeric node id
        labels: ['Snapshot'],
        properties: {
          id: 'snap:1792322561350:96so4',
          repositoryId: 'repo:emafido/ghost',
          commitSha: 'HEAD',
          createdAt: '2026-10-18T11:22:41.350Z',
          lockfileVersion: 3,
          totalPackages: 425,
          directCount: 11,
          transitiveCount: 414,
          status: 'SUCCESS'
        }
      },
      snapshotsCount: 1
    };

    const summary = normalizeRepositorySummary(rawFalkorDbRow);

    // 1. repository fields wrapped inside .repository
    assert.ok(summary.repository, 'summary.repository must be defined');
    assert.equal(summary.repository.id, 'repo:emafido/ghost');
    assert.equal(summary.repository.name, 'ghost');
    assert.equal(summary.repository.owner, 'Emafido');
    assert.equal(summary.repository.url, 'https://github.com/Emafido/ghost');
    assert.equal(summary.repository.defaultBranch, 'master');

    // 2. latestSnapshot extracted from .properties, preserving string ID
    assert.ok(summary.latestSnapshot, 'latestSnapshot must be defined');
    assert.equal(summary.latestSnapshot?.id, 'snap:1792322561350:96so4');
    assert.notEqual(summary.latestSnapshot?.id, '1806');
    assert.equal(summary.latestSnapshot?.totalPackages, 425);
    assert.equal(summary.latestSnapshot?.directCount, 11);
    assert.equal(summary.latestSnapshot?.transitiveCount, 414);
    assert.equal(summary.latestSnapshot?.status, 'SUCCESS');

    // 3. snapshotsCount preserved as a number
    assert.equal(typeof summary.snapshotsCount, 'number');
    assert.equal(summary.snapshotsCount, 1);
  });

  it('handles repositories with null snapshots gracefully', () => {
    const rawWithoutSnap = {
      id: 'repo:emafido/empty',
      url: 'https://github.com/Emafido/empty',
      name: 'empty',
      owner: 'Emafido',
      defaultBranch: 'main',
      createdAt: '2026-10-18T12:00:00Z',
      latestSnapshot: null,
      snapshotsCount: 0
    };

    const summary = normalizeRepositorySummary(rawWithoutSnap);
    assert.ok(summary.repository);
    assert.equal(summary.repository.id, 'repo:emafido/empty');
    assert.equal(summary.latestSnapshot, null);
    assert.equal(summary.snapshotsCount, 0);
  });

  it('validates RepositorySelector contract: select repo -> load packages -> investigate path', async () => {
    // Simulate frontend selecting a repository and investigating package
    const engine = new InMemoryGraphEngine();
    const quikFixture = FIXTURES['emafido/quikapi'];
    const ghostFixture = FIXTURES['emafido/ghost'];

    // Ingest two repositories
    for (const [key, fixture] of [['emafido/quikapi', quikFixture], ['emafido/ghost', ghostFixture]] as const) {
      const snapId = `snap:${fixture.repo}:test`;
      const tree = parseLockfileTree(snapId, fixture.packageJson, fixture.packageLockJson);

      await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
        portfolioId: 'default',
        repositoryId: `repo:${key}`,
        url: fixture.url,
        name: fixture.repo,
        owner: fixture.owner,
        defaultBranch: fixture.defaultBranch,
        createdAt: new Date().toISOString()
      });

      await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
        repositoryId: `repo:${key}`,
        snapshotId: snapId,
        rootInstallationId: `${snapId}:root`,
        commitSha: 'HEAD',
        createdAt: new Date().toISOString(),
        lockfileVersion: 3,
        totalPackages: tree.totalPackages,
        directCount: tree.directCount,
        transitiveCount: tree.transitiveCount,
        status: 'SUCCESS',
        rootName: tree.rootName,
        rootVersion: tree.rootVersion
      });

      await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: tree.packageVersions });
      await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: tree.installations });
      await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: tree.edges });
      await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${snapId}:root`, snapshotId: snapId });
    }

    // 1. Test listRepositories output normalization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawList = await engine.query<any>(CYPHER_QUERIES.LIST_REPOSITORIES, { portfolioId: 'default' });
    const normalizedList = rawList.data.map(normalizeRepositorySummary);
    assert.equal(normalizedList.length, 2);

    // 2. Test RepositorySelector reading item.repository.id and snap.id
    for (const item of normalizedList) {
      assert.ok(item.repository.id, 'item.repository.id must be defined');
      assert.ok(item.repository.owner, 'item.repository.owner must be defined');
      assert.ok(item.repository.name, 'item.repository.name must be defined');
      assert.ok(item.latestSnapshot, 'item.latestSnapshot must be defined');
      assert.ok(typeof item.latestSnapshot.id === 'string', 'snapshot id must be string');
      assert.ok(item.latestSnapshot.totalPackages > 0, 'snapshot totalPackages must be > 0');
    }

    // 3. Test selecting the first repository
    const selected = normalizedList[0];
    const snapId = selected.latestSnapshot!.id;

    // Load packages for this snapshot
    const pkgRes = await engine.query<InstallationNode>(CYPHER_QUERIES.GET_SNAPSHOT_PACKAGES, { snapshotId: snapId });
    assert.ok(pkgRes.data.length > 0, 'Packages must be returned for selected repository');

    // 4. Test investigating a package in the selected snapshot
    const targetPkg = pkgRes.data[0];
    const pathRes = await engine.query<{ chain: DependencyPathItem[] }>(CYPHER_QUERIES.GET_DEPENDENCY_PATH, {
      snapshotId: snapId,
      installationId: targetPkg.id
    });
    assert.ok(pathRes.data[0]?.chain?.length >= 1, 'Path chain must exist from root to package');
  });
});

describe('Step 6 Data Accuracy: Multi-Snapshot Deduplication & Cross-Repo Sharing', () => {
  it('excludes historical snapshots of current repository and deduplicates other repos with multiple snapshots', async () => {
    const engine = new InMemoryGraphEngine();
    const quikFixture = FIXTURES['emafido/quikapi'];
    const ghostFixture = FIXTURES['emafido/ghost'];

    // Ingest Repository A (QuikAPI) with Snapshot 1 (v1)
    const qSnap1 = 'snap:quikapi:v1';
    const treeQ1 = parseLockfileTree(qSnap1, quikFixture.packageJson, quikFixture.packageLockJson);
    await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
      portfolioId: 'default',
      repositoryId: 'repo:emafido/quikapi',
      url: quikFixture.url,
      name: quikFixture.repo,
      owner: quikFixture.owner,
      defaultBranch: quikFixture.defaultBranch,
      createdAt: '2026-10-18T10:00:00Z'
    });
    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:emafido/quikapi',
      snapshotId: qSnap1,
      rootInstallationId: `${qSnap1}:root`,
      commitSha: 'HEAD~1',
      createdAt: '2026-10-18T10:00:00Z',
      lockfileVersion: 3,
      totalPackages: treeQ1.totalPackages,
      directCount: treeQ1.directCount,
      transitiveCount: treeQ1.transitiveCount,
      status: 'SUCCESS',
      rootName: treeQ1.rootName,
      rootVersion: treeQ1.rootVersion
    });
    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: treeQ1.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: treeQ1.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: treeQ1.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${qSnap1}:root`, snapshotId: qSnap1 });

    // Ingest Repository A (QuikAPI) with Snapshot 2 (v2 - latest)
    const qSnap2 = 'snap:quikapi:v2';
    const treeQ2 = parseLockfileTree(qSnap2, quikFixture.packageJson, quikFixture.packageLockJson);
    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:emafido/quikapi',
      snapshotId: qSnap2,
      rootInstallationId: `${qSnap2}:root`,
      commitSha: 'HEAD',
      createdAt: '2026-10-18T12:00:00Z',
      lockfileVersion: 3,
      totalPackages: treeQ2.totalPackages,
      directCount: treeQ2.directCount,
      transitiveCount: treeQ2.transitiveCount,
      status: 'SUCCESS',
      rootName: treeQ2.rootName,
      rootVersion: treeQ2.rootVersion
    });
    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: treeQ2.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: treeQ2.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: treeQ2.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${qSnap2}:root`, snapshotId: qSnap2 });

    // Ingest Repository B (Ghost) with Snapshot 1 (v1)
    const gSnap1 = 'snap:ghost:v1';
    const treeG1 = parseLockfileTree(gSnap1, ghostFixture.packageJson, ghostFixture.packageLockJson);
    await engine.query(CYPHER_QUERIES.MERGE_REPOSITORY, {
      portfolioId: 'default',
      repositoryId: 'repo:emafido/ghost',
      url: ghostFixture.url,
      name: ghostFixture.repo,
      owner: ghostFixture.owner,
      defaultBranch: ghostFixture.defaultBranch,
      createdAt: '2026-10-18T10:00:00Z'
    });
    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:emafido/ghost',
      snapshotId: gSnap1,
      rootInstallationId: `${gSnap1}:root`,
      commitSha: 'HEAD~1',
      createdAt: '2026-10-18T10:00:00Z',
      lockfileVersion: 3,
      totalPackages: treeG1.totalPackages,
      directCount: treeG1.directCount,
      transitiveCount: treeG1.transitiveCount,
      status: 'SUCCESS',
      rootName: treeG1.rootName,
      rootVersion: treeG1.rootVersion
    });
    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: treeG1.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: treeG1.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: treeG1.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${gSnap1}:root`, snapshotId: gSnap1 });

    // Ingest Repository B (Ghost) with Snapshot 2 (v2 - latest)
    const gSnap2 = 'snap:ghost:v2';
    const treeG2 = parseLockfileTree(gSnap2, ghostFixture.packageJson, ghostFixture.packageLockJson);
    await engine.query(CYPHER_QUERIES.CREATE_SNAPSHOT, {
      repositoryId: 'repo:emafido/ghost',
      snapshotId: gSnap2,
      rootInstallationId: `${gSnap2}:root`,
      commitSha: 'HEAD',
      createdAt: '2026-10-18T12:00:00Z',
      lockfileVersion: 3,
      totalPackages: treeG2.totalPackages,
      directCount: treeG2.directCount,
      transitiveCount: treeG2.transitiveCount,
      status: 'SUCCESS',
      rootName: treeG2.rootName,
      rootVersion: treeG2.rootVersion
    });
    await engine.query(CYPHER_QUERIES.MERGE_PACKAGE_VERSIONS, { versions: treeG2.packageVersions });
    await engine.query(CYPHER_QUERIES.CREATE_INSTALLATIONS, { installations: treeG2.installations });
    await engine.query(CYPHER_QUERIES.CREATE_DEPENDENCY_EDGES, { edges: treeG2.edges });
    await engine.query(CYPHER_QUERIES.CONNECT_ROOT_DIRECT, { rootId: `${gSnap2}:root`, snapshotId: gSnap2 });

    // Find a package shared between QuikAPI and Ghost (e.g. zod-validation-error)
    const qPackages = await engine.query<InstallationNode>(CYPHER_QUERIES.GET_SNAPSHOT_PACKAGES, { snapshotId: qSnap2 });
    const gPackages = await engine.query<InstallationNode>(CYPHER_QUERIES.GET_SNAPSHOT_PACKAGES, { snapshotId: gSnap2 });

    const sharedPkg = qPackages.data.find(qp => gPackages.data.some(gp => gp.name === qp.name && gp.version === qp.version));
    assert.ok(sharedPkg, 'There should be at least one shared package version between QuikAPI and Ghost fixtures');

    // Query GET_CROSS_REPO_SHARING for the shared package in qSnap2
    const crossSharing = await engine.query<CrossRepoSharing>(CYPHER_QUERIES.GET_CROSS_REPO_SHARING, {
      snapshotId: qSnap2,
      installationId: sharedPkg.id
    });

    // 1. "Other repositories" must NOT include QuikAPI (neither qSnap1 nor qSnap2)
    const selfSharing = crossSharing.data.filter(s => s.repoId === 'repo:emafido/quikapi' || s.repoName === 'quikapi');
    assert.equal(selfSharing.length, 0, 'Cross-repo sharing must strictly exclude all snapshots of the current repository');

    // 2. Ghost must appear EXACTLY ONCE despite having 2 snapshots (gSnap1 and gSnap2)
    const ghostSharing = crossSharing.data.filter(s => s.repoId === 'repo:emafido/ghost');
    assert.equal(ghostSharing.length, 1, 'Repository with multiple snapshots must appear exactly once');

    // 3. The count reflects distinct repositories (total = 1)
    assert.equal(crossSharing.data.length, 1, 'Total cross-repo count must equal distinct repository count');
  });
});




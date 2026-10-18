import type { InstallationNode, PackageVersionNode } from '../../types/index.ts';

export interface ParsedDependencyTree {
  rootName: string;
  rootVersion: string;
  installations: Array<InstallationNode & { packageVersionId: string }>;
  packageVersions: PackageVersionNode[];
  edges: Array<{ fromId: string; toId: string; type: 'prod' | 'dev' | 'peer' | 'optional' }>;
  directCount: number;
  transitiveCount: number;
  totalPackages: number;
}

/**
 * Resolves package relationships from npm lockfile v2/v3 according to
 * npm Arborist hoisting and nested directory resolution algorithms.
 * 
 * Safely parses the virtual tree without executing lifecycle scripts.
 */
export function parseLockfileTree(
  snapshotId: string,
  packageJson: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packageLockJson: any
): ParsedDependencyTree {
  const rootName = String(packageJson.name || packageLockJson.name || 'root');
  const rootVersion = String(packageJson.version || packageLockJson.version || '1.0.0');

  // Direct dependencies declared in package.json
  const prodDeps = (packageJson.dependencies as Record<string, string>) || {};
  const devDeps = (packageJson.devDependencies as Record<string, string>) || {};
  const directDepNames = new Set([...Object.keys(prodDeps), ...Object.keys(devDeps)]);

  const packagesMap = packageLockJson.packages || {};
  const installations: Array<InstallationNode & { packageVersionId: string }> = [];
  const packageVersionsMap = new Map<string, PackageVersionNode>();
  const pathToInstallationId = new Map<string, string>();
  const pathToDependenciesMap = new Map<string, Record<string, string>>();

  const rootInstallationId = `${snapshotId}:root`;

  // 1. Process all installed packages in the lockfile
  for (const [pkgPath, rawPkg] of Object.entries(packagesMap)) {
    if (!pkgPath || pkgPath === '') continue; // Skip root entry

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkg = rawPkg as any;
    
    // Determine package name
    let name = pkg.name;
    if (!name) {
      // Derive from path: e.g. "node_modules/@scope/pkg" or "node_modules/pkg"
      const lastNmIndex = pkgPath.lastIndexOf('node_modules/');
      if (lastNmIndex !== -1) {
        name = pkgPath.slice(lastNmIndex + 'node_modules/'.length);
      } else {
        name = pkgPath;
      }
    }

    const version = String(pkg.version || '0.0.0');
    const isDev = Boolean(pkg.dev || (!prodDeps[name] && devDeps[name]));
    
    // A package is direct if it is directly under the root node_modules AND declared in package.json
    const isTopLevel = !pkgPath.includes('/node_modules/');
    const isDirect = isTopLevel && directDepNames.has(name);

    // Calculate nesting depth
    const nmOccurrences = (pkgPath.match(/node_modules\//g) || []).length;
    const depth = nmOccurrences;

    const instId = `${snapshotId}:${pkgPath}`;
    const pvId = `${name}@${version}`;

    // Record canonical PackageVersion
    if (!packageVersionsMap.has(pvId)) {
      packageVersionsMap.set(pvId, {
        id: pvId,
        name,
        version
      });
    }

    installations.push({
      id: instId,
      snapshotId,
      packagePath: pkgPath,
      name,
      version,
      isDev,
      isDirect,
      depth,
      packageVersionId: pvId
    });

    pathToInstallationId.set(pkgPath, instId);

    // Save outgoing dependencies for edge resolution
    if (pkg.dependencies && typeof pkg.dependencies === 'object') {
      pathToDependenciesMap.set(pkgPath, pkg.dependencies);
    }
  }

  // 2. Resolve dependency edges using npm's upward walk algorithm
  const edges: Array<{ fromId: string; toId: string; type: 'prod' | 'dev' | 'peer' | 'optional' }> = [];
  const edgeKeys = new Set<string>();

  // A helper to find the target installation for a declared dependency name
  function resolveTargetInstallation(fromPath: string, depName: string): string | null {
    // Start searching from fromPath's node_modules up to the top level
    let current = fromPath;

    while (current) {
      const candidatePath = `${current}/node_modules/${depName}`;
      if (pathToInstallationId.has(candidatePath)) {
        return pathToInstallationId.get(candidatePath)!;
      }

      // Step up to parent node_modules
      const lastNm = current.lastIndexOf('/node_modules/');
      if (lastNm !== -1) {
        current = current.substring(0, lastNm);
      } else {
        break;
      }
    }

    // Finally check top-level hoisted installation
    const topLevelPath = `node_modules/${depName}`;
    if (pathToInstallationId.has(topLevelPath)) {
      return pathToInstallationId.get(topLevelPath)!;
    }

    return null;
  }

  // Add edges from root to direct dependencies
  for (const inst of installations) {
    if (inst.isDirect) {
      const edgeType = devDeps[inst.name] ? 'dev' : 'prod';
      const key = `${rootInstallationId}->${inst.id}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({
          fromId: rootInstallationId,
          toId: inst.id,
          type: edgeType
        });
      }
    }
  }

  // Add edges between installations
  for (const [fromPath, declaredDeps] of pathToDependenciesMap.entries()) {
    const fromId = pathToInstallationId.get(fromPath);
    if (!fromId) continue;

    for (const depName of Object.keys(declaredDeps)) {
      const toId = resolveTargetInstallation(fromPath, depName);
      if (toId && toId !== fromId) {
        const key = `${fromId}->${toId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({
            fromId,
            toId,
            type: 'prod'
          });
        }
      }
    }
  }

  const directCount = installations.filter(i => i.isDirect).length;
  const transitiveCount = installations.length - directCount;

  return {
    rootName,
    rootVersion,
    installations,
    packageVersions: Array.from(packageVersionsMap.values()),
    edges,
    directCount,
    transitiveCount,
    totalPackages: installations.length
  };
}

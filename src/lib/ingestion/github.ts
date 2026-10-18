export interface GitHubRepoMeta {
  owner: string;
  repo: string;
  url: string;
  defaultBranch?: string;
}

export interface FetchedRepoFiles {
  owner: string;
  repo: string;
  defaultBranch: string;
  packageJson: Record<string, unknown>;
  packageLockJson: Record<string, unknown>;
  lockfileVersion: number;
}

/**
 * Parses and validates arbitrary public GitHub repository URLs.
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - http://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(rawInput: string): GitHubRepoMeta {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('Please enter a valid GitHub repository URL.');
  }

  const cleaned = rawInput.trim().replace(/\.git$/, '').replace(/\/$/, '');
  
  // Regex to extract owner and repo
  const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i)
    || cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);

  if (!match) {
    throw new Error(
      `Invalid repository URL "${rawInput}". Please enter a valid public GitHub URL (e.g. "https://github.com/owner/repo" or "owner/repo").`
    );
  }

  const owner = match[1];
  const repo = match[2];

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`
  };
}

/**
 * Fetches package.json and package-lock.json from a public GitHub repository.
 * Probes both 'main' and 'master' branches.
 */
export async function fetchGitHubRepoFiles(meta: GitHubRepoMeta): Promise<FetchedRepoFiles> {
  const branchesToTry = ['main', 'master'];
  const token = process.env.GITHUB_TOKEN;

  // If token is provided, probe repo info for default branch
  if (token) {
    try {
      const apiRes = await fetch(`https://api.github.com/repos/${meta.owner}/${meta.repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Patch-Dependency-Security-Agent',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (apiRes.ok) {
        const repoData = await apiRes.json();
        if (repoData.default_branch && !branchesToTry.includes(repoData.default_branch)) {
          branchesToTry.unshift(repoData.default_branch);
        }
      }
    } catch {
      // Ignore API errors, fall back to branch probing
    }
  }

  let foundBranch: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pkgJson: any = null;

  // 1. Fetch package.json
  for (const branch of branchesToTry) {
    const url = `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${branch}/package.json`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Patch-Agent' } });
      if (res.ok) {
        const text = await res.text();
        pkgJson = JSON.parse(text);
        foundBranch = branch;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!pkgJson || !foundBranch) {
    throw new Error(
      `Could not locate a valid "package.json" in https://github.com/${meta.owner}/${meta.repo} (tested branches: ${branchesToTry.join(', ')}). Ensure the repository is public and contains a JavaScript/TypeScript project.`
    );
  }

  // 2. Fetch package-lock.json from the same branch
  const lockUrl = `https://raw.githubusercontent.com/${meta.owner}/${meta.repo}/${foundBranch}/package-lock.json`;
  let lockJson: Record<string, unknown> | null = null;

  try {
    const lockRes = await fetch(lockUrl, { headers: { 'User-Agent': 'Patch-Agent' } });
    if (!lockRes.ok) {
      if (lockRes.status === 404) {
        throw new Error(
          `Repository https://github.com/${meta.owner}/${meta.repo} is missing a "package-lock.json". Patch requires an npm lockfile (version 2 or 3) to accurately construct the dependency graph.`
        );
      }
      throw new Error(`Failed to fetch package-lock.json (HTTP status ${lockRes.status}).`);
    }

    const lockText = await lockRes.text();
    // Size safety guard: reject if lockfile is unusually huge (> 20MB)
    if (lockText.length > 20 * 1024 * 1024) {
      throw new Error('Lockfile exceeds maximum permitted size (20MB).');
    }

    lockJson = JSON.parse(lockText);
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error(`Could not parse package-lock.json: ${String(err)}`);
  }

  if (!lockJson) {
    throw new Error(`Failed to parse "package-lock.json" from ${meta.url}.`);
  }

  // Validate lockfile version
  const lockfileVersion = Number(lockJson.lockfileVersion || 1);
  if (lockfileVersion === 1) {
    throw new Error(
      `Repository uses npm lockfileVersion 1, which lacks modern package path mappings. Patch supports modern npm lockfile versions 2 and 3. Please run "npm install" on npm 7+ and commit the updated lockfile.`
    );
  }

  return {
    owner: meta.owner,
    repo: meta.repo,
    defaultBranch: foundBranch,
    packageJson: pkgJson,
    packageLockJson: lockJson,
    lockfileVersion
  };
}

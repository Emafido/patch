import type { VulnerabilityNode, VulnerabilitySeverity } from '../../types/index.ts';

interface OSVQueryItem {
  package: {
    name: string;
    ecosystem: string;
  };
  version: string;
}

interface OSVRangesEvent {
  introduced?: string;
  fixed?: string;
}

interface OSVRanges {
  type: string;
  events?: OSVRangesEvent[];
}

interface OSVAffected {
  package?: {
    name: string;
    ecosystem: string;
  };
  ranges?: OSVRanges[];
}

interface OSVVulnerabilityRaw {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  published?: string;
  modified?: string;
  references?: Array<{ type: string; url: string }>;
  database_specific?: {
    severity?: string;
  };
  severity?: Array<{ type: string; score: string }>;
  affected?: OSVAffected[];
}

interface OSVBatchResponse {
  results?: Array<{
    vulns?: OSVVulnerabilityRaw[];
  }>;
}

export interface OSVScanResult {
  vulnerabilities: VulnerabilityNode[];
  links: Array<{
    packageVersionId: string;
    vulnerabilityId: string;
  }>;
}

/**
 * Normalizes OSV severity strings into standard enum
 */
export function normalizeSeverity(raw?: string): VulnerabilitySeverity {
  if (!raw) return 'UNKNOWN';
  const upper = raw.toUpperCase();
  if (upper.includes('CRITICAL')) return 'CRITICAL';
  if (upper.includes('HIGH')) return 'HIGH';
  if (upper.includes('MODERATE') || upper.includes('MEDIUM')) return 'MODERATE';
  if (upper.includes('LOW')) return 'LOW';
  return 'UNKNOWN';
}

/**
 * Extracts the first fixed version from affected ranges
 */
export function extractFixedVersion(affected?: OSVAffected[]): string | undefined {
  if (!affected || !Array.isArray(affected)) return undefined;
  for (const aff of affected) {
    if (aff.ranges && Array.isArray(aff.ranges)) {
      for (const range of aff.ranges) {
        if (range.events && Array.isArray(range.events)) {
          for (const event of range.events) {
            if (event.fixed) {
              return event.fixed;
            }
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Queries the official OSV.dev batch API for real npm package vulnerabilities
 */
export async function queryOSVBatch(
  packages: Array<{ name: string; version: string }>
): Promise<OSVScanResult> {
  if (!packages || packages.length === 0) {
    return { vulnerabilities: [], links: [] };
  }

  // Deduplicate input packages
  const uniquePackagesMap = new Map<string, { name: string; version: string }>();
  for (const pkg of packages) {
    const key = `${pkg.name}@${pkg.version}`;
    if (!uniquePackagesMap.has(key)) {
      uniquePackagesMap.set(key, pkg);
    }
  }
  const uniquePackages = Array.from(uniquePackagesMap.values());

  const vulnerabilitiesMap = new Map<string, VulnerabilityNode>();
  const links: Array<{ packageVersionId: string; vulnerabilityId: string }> = [];
  const linkKeys = new Set<string>();

  // OSV API recommends chunks up to 500
  const CHUNK_SIZE = 100;
  for (let i = 0; i < uniquePackages.length; i += CHUNK_SIZE) {
    const chunk = uniquePackages.slice(i, i + CHUNK_SIZE);
    const queries: OSVQueryItem[] = chunk.map(pkg => ({
      package: {
        name: pkg.name,
        ecosystem: 'npm'
      },
      version: pkg.version
    }));

    try {
      const response = await fetch('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Patch-Security-Agent'
        },
        body: JSON.stringify({ queries })
      });

      if (!response.ok) {
        console.warn(`[OSV] Batch query HTTP ${response.status}: ${await response.text().catch(() => '')}`);
        continue;
      }

      const data = (await response.json()) as OSVBatchResponse;
      const results = data.results || [];

      for (let j = 0; j < results.length; j++) {
        const pkg = chunk[j];
        if (!pkg) continue;

        const packageVersionId = `${pkg.name}@${pkg.version}`;
        const vulns = results[j]?.vulns || [];

        for (const rawVuln of vulns) {
          const vulnId = rawVuln.id;
          const cveId = rawVuln.aliases?.find(a => a.startsWith('CVE-'));
          const severity = normalizeSeverity(rawVuln.database_specific?.severity);
          const fixedVersion = extractFixedVersion(rawVuln.affected);
          
          let primaryUrl = `https://osv.dev/vulnerability/${vulnId}`;
          const advisoryRef = rawVuln.references?.find(r => r.type === 'ADVISORY' || r.type === 'WEB');
          if (advisoryRef?.url) {
            primaryUrl = advisoryRef.url;
          }

          if (!vulnerabilitiesMap.has(vulnId)) {
            vulnerabilitiesMap.set(vulnId, {
              id: vulnId,
              cveId,
              summary: rawVuln.summary || `Vulnerability in ${pkg.name}`,
              details: rawVuln.details || rawVuln.summary,
              severity,
              fixedVersion,
              url: primaryUrl,
              publishedAt: rawVuln.published,
              modifiedAt: rawVuln.modified
            });
          }

          const linkKey = `${packageVersionId}->${vulnId}`;
          if (!linkKeys.has(linkKey)) {
            linkKeys.add(linkKey);
            links.push({
              packageVersionId,
              vulnerabilityId: vulnId
            });
          }
        }
      }
    } catch (err) {
      console.error(`[OSV] Failed to fetch vulnerabilities for chunk ${i}:`, err);
    }
  }

  return {
    vulnerabilities: Array.from(vulnerabilitiesMap.values()),
    links
  };
}

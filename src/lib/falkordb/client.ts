import type { FalkorDriver, QueryResult } from './types.ts';
import { InMemoryGraphEngine } from './in-memory-engine.ts';

class FalkorLiveDriver implements FalkorDriver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private graph: any;
  private graphName: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any, graphName: string) {
    this.client = client;
    this.graphName = graphName;
    this.graph = client.selectGraph(graphName);
  }

  isMock(): boolean {
    return false;
  }

  getConnectionStatus(): { connected: boolean; type: 'FALKORDB_LIVE' | 'DISCONNECTED' | 'IN_MEMORY_GRAPH'; details: string } {
    return {
      connected: true,
      type: 'FALKORDB_LIVE',
      details: `Connected to FalkorDB (Graph: ${this.graphName})`
    };
  }

  async close(): Promise<void> {
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
    }
  }

  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) {
        clean[k] = null;
      } else if (Array.isArray(v)) {
        clean[k] = v.map(item => (typeof item === 'object' && item !== null ? this.sanitizeParams(item as Record<string, unknown>) : (item === undefined ? null : item)));
      } else if (typeof v === 'object' && v !== null) {
        clean[k] = this.sanitizeParams(v as Record<string, unknown>);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  async query<T = Record<string, unknown>>(queryStr: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
    try {
      const cleanParams = this.sanitizeParams(params);
      const result = await this.graph.query(queryStr, { params: cleanParams });
      const records = result.data || [];
      return { data: records as T[], metadata: result.metadata };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FalkorDB Query Error] Query: ${queryStr.slice(0, 100)}... Params:`, JSON.stringify(params), 'Error:', msg);
      throw new Error(`FalkorDB query failed: ${msg}`);
    }
  }
}

class DisconnectedFalkorDriver implements FalkorDriver {
  private errorMessage: string;

  constructor(errorMessage: string) {
    this.errorMessage = errorMessage;
  }

  isMock(): boolean {
    return false;
  }

  getConnectionStatus(): { connected: boolean; type: 'FALKORDB_LIVE' | 'DISCONNECTED' | 'IN_MEMORY_GRAPH'; details: string } {
    return {
      connected: false,
      type: 'DISCONNECTED',
      details: this.errorMessage
    };
  }

  async close(): Promise<void> {}

  async query<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    throw new Error(`[FalkorDB Connection Error] Real FalkorDB is required. Database is disconnected: ${this.errorMessage}`);
  }
}

// Global singleton to persist driver across Next.js API reloads in dev mode
const globalForFalkor = globalThis as unknown as {
  falkorDriverInstance?: FalkorDriver;
};

export async function getFalkorDriver(options?: { allowMockInTests?: boolean }): Promise<FalkorDriver> {
  // Explicit opt-in for unit tests only
  if (options?.allowMockInTests || process.env.PATCH_TEST_MOCK_GRAPH === 'true') {
    if (!globalForFalkor.falkorDriverInstance || !globalForFalkor.falkorDriverInstance.isMock()) {
      globalForFalkor.falkorDriverInstance = new InMemoryGraphEngine();
    }
    return globalForFalkor.falkorDriverInstance;
  }

  if (globalForFalkor.falkorDriverInstance && !globalForFalkor.falkorDriverInstance.isMock() && globalForFalkor.falkorDriverInstance.getConnectionStatus().connected) {
    return globalForFalkor.falkorDriverInstance;
  }

  const graphName = process.env.FALKORDB_GRAPH_NAME || 'patch_dependency_graph';
  const url = process.env.FALKORDB_URL;
  const host = process.env.FALKORDB_HOST || '127.0.0.1';
  const port = parseInt(process.env.FALKORDB_PORT || '6379', 10);
  const username = process.env.FALKORDB_USERNAME;
  const password = process.env.FALKORDB_PASSWORD;

  try {
    let falkorModule;
    try {
      falkorModule = await import('falkordb');
    } catch (importErr) {
      console.error('[FalkorDB import error]:', importErr);
      throw new Error(`Failed to load falkordb module: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
    }

    const FalkorDB = falkorModule.FalkorDB || (falkorModule.default as Record<string, unknown>)?.FalkorDB || falkorModule.default;
    if (!FalkorDB || typeof FalkorDB.connect !== 'function') {
      throw new Error('FalkorDB client constructor not found on module.');
    }

    let client;

    if (url) {
      client = await FalkorDB.connect({ url });
    } else if (password) {
      client = await FalkorDB.connect({
        socket: { host, port, connectTimeout: 10000 },
        username: username || undefined,
        password
      });
    } else {
      client = await FalkorDB.connect({
        socket: { host, port, connectTimeout: 10000 }
      });
    }

    // Verify database responsiveness with Cypher test query
    const testGraph = client.selectGraph(graphName);
    await testGraph.query('RETURN 1 as test');

    // Ensure essential indices exist (idempotent, safe across restarts)
    ensureEssentialIndices(testGraph).catch(idxErr => {
      console.warn('[FalkorDB] Index verification notice:', idxErr instanceof Error ? idxErr.message : String(idxErr));
    });

    const liveDriver = new FalkorLiveDriver(client, graphName);
    globalForFalkor.falkorDriverInstance = liveDriver;
    console.log(`[FalkorDB] Connected successfully to ${url ? 'cloud instance' : `${host}:${port}`} (Graph: ${graphName})`);
    return liveDriver;
  } catch (err) {
    const connectionTarget = url ? 'FalkorDB Cloud URL' : `${host}:${port}`;
    const errMsg = `Could not connect to FalkorDB at ${connectionTarget} (${err instanceof Error ? err.message : String(err)}). Configure FALKORDB_URL or FALKORDB_HOST in .env.local.`;
    console.error(`[FalkorDB CRITICAL] ${errMsg}`);

    const disconnected = new DisconnectedFalkorDriver(errMsg);
    globalForFalkor.falkorDriverInstance = disconnected;
    return disconnected;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureEssentialIndices(graph: any): Promise<void> {
  const indexStatements = [
    'CREATE INDEX FOR (p:Portfolio) ON (p.id);',
    'CREATE INDEX FOR (r:Repository) ON (r.id);',
    'CREATE INDEX FOR (s:Snapshot) ON (s.id);',
    'CREATE INDEX FOR (i:Installation) ON (i.id);',
    'CREATE INDEX FOR (i:Installation) ON (i.snapshotId);',
    'CREATE INDEX FOR (pv:PackageVersion) ON (pv.id);',
    'CREATE INDEX FOR (v:Vulnerability) ON (v.id);'
  ];

  for (const stmt of indexStatements) {
    try {
      await graph.query(stmt);
    } catch {
      // Attribute is already indexed; safe to ignore
    }
  }
}


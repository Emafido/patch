import { FalkorDriver, QueryResult } from './types.ts';
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

  getConnectionStatus(): { connected: boolean; type: 'FALKORDB_LIVE' | 'IN_MEMORY_GRAPH'; details: string } {
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

  async query<T = Record<string, unknown>>(queryStr: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
    try {
      const result = await this.graph.query(queryStr, { params });
      const records = result.data || [];
      return { data: records as T[], metadata: result.metadata };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`FalkorDB query failed: ${msg}`);
    }
  }
}

// Global singleton to persist driver across Next.js API reloads in dev mode
const globalForFalkor = globalThis as unknown as {
  falkorDriverInstance?: FalkorDriver;
};

export async function getFalkorDriver(): Promise<FalkorDriver> {
  if (globalForFalkor.falkorDriverInstance) {
    return globalForFalkor.falkorDriverInstance;
  }

  const graphName = process.env.FALKORDB_GRAPH_NAME || 'patch_dependency_graph';
  const url = process.env.FALKORDB_URL;
  const host = process.env.FALKORDB_HOST || '127.0.0.1';
  const port = parseInt(process.env.FALKORDB_PORT || '6379', 10);
  const username = process.env.FALKORDB_USERNAME;
  const password = process.env.FALKORDB_PASSWORD;

  // Try to connect to real FalkorDB if available
  try {
    // Dynamic import to avoid build errors if package is still installing
    const falkorModule = await import('falkordb').catch(() => null);
    if (falkorModule && (falkorModule.FalkorDB || falkorModule.default)) {
      const FalkorDB = falkorModule.FalkorDB || falkorModule.default;
      let client;

      if (url) {
        client = await FalkorDB.connect({ url });
      } else if (password) {
        client = await FalkorDB.connect({
          socket: { host, port },
          username: username || undefined,
          password
        });
      } else {
        client = await FalkorDB.connect({
          socket: { host, port }
        });
      }

      // Quick test query to ensure database is responsive
      const testGraph = client.selectGraph(graphName);
      await testGraph.query('RETURN 1 as test');

      const liveDriver = new FalkorLiveDriver(client, graphName);
      globalForFalkor.falkorDriverInstance = liveDriver;
      console.log(`[FalkorDB] Connected successfully to ${url ? 'cloud instance' : `${host}:${port}`}`);
      return liveDriver;
    }
  } catch (err) {
    console.warn(`[FalkorDB] Live connection failed (${err instanceof Error ? err.message : String(err)}). Falling back to In-Memory Graph Engine.`);
  }

  // Graceful fallback to In-Memory Graph Engine
  const inMemory = new InMemoryGraphEngine();
  globalForFalkor.falkorDriverInstance = inMemory;
  return inMemory;
}

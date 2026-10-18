export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  metadata?: Record<string, unknown>;
}

export type FalkorEngineType = 'FALKORDB_LIVE' | 'DISCONNECTED' | 'IN_MEMORY_GRAPH';

export interface FalkorDriver {
  query<T = Record<string, unknown>>(query: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  close(): Promise<void>;
  isMock(): boolean;
  getConnectionStatus(): { connected: boolean; type: FalkorEngineType; details: string };
}

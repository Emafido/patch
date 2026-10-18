export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  metadata?: Record<string, unknown>;
}

export interface FalkorDriver {
  query<T = Record<string, unknown>>(query: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  close(): Promise<void>;
  isMock(): boolean;
  getConnectionStatus(): { connected: boolean; type: 'FALKORDB_LIVE' | 'IN_MEMORY_GRAPH'; details: string };
}

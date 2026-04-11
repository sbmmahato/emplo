import { GoclawHttpError } from './errors';

export type GoclawRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  json?: boolean;
};

export type GoclawClientConfig = {
  baseUrl: string;
  bearerToken: string;
  userId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

async function rawRequest(
  fetchFn: typeof fetch,
  base: string,
  path: string,
  bearerToken: string,
  userId: string,
  options: GoclawRequestOptions,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; text: string }> {
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const sendJson = options.json !== false;
  try {
    const res = await fetchFn(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'X-GoClaw-User-Id': userId,
        ...(sendJson && options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers
      },
      body:
        options.body === undefined
          ? undefined
          : sendJson
            ? JSON.stringify(options.body)
            : (options.body as BodyInit),
      signal: controller.signal
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

/**
 * HTTP client for GoClaw `/v1` REST API (server-side).
 */
export function createGoclawClient(config: GoclawClientConfig) {
  const fetchFn = config.fetchImpl ?? fetch;
  const base = config.baseUrl.replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? 60_000;

  async function request<T = unknown>(
    path: string,
    options: GoclawRequestOptions = {}
  ): Promise<T> {
    const { ok, status, text } = await rawRequest(
      fetchFn,
      base,
      path,
      config.bearerToken,
      config.userId,
      options,
      timeoutMs
    );
    if (!ok) {
      throw new GoclawHttpError(`GoClaw HTTP ${status} ${path}`, status, text);
    }
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  return {
    request,
    health: async () => {
      const url = `${base}/health`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchFn(url, { method: 'GET', signal: controller.signal });
        const text = await res.text();
        return { ok: res.ok, status: res.status, text };
      } finally {
        clearTimeout(t);
      }
    },
    listTenants: () => request<unknown>('/v1/tenants'),
    createTenant: (body: Record<string, unknown>) =>
      request<unknown>('/v1/tenants', { method: 'POST', body }),
    addTenantUser: (tenantId: string, body: Record<string, unknown>) =>
      request<unknown>(`/v1/tenants/${tenantId}/users`, {
        method: 'POST',
        body
      }),
    createApiKey: (body: Record<string, unknown>) =>
      request<unknown>('/v1/api-keys', { method: 'POST', body }),
    listAgents: () => request<unknown>('/v1/agents'),
    getAgent: (id: string) => request<unknown>(`/v1/agents/${id}`),
    createAgent: (body: Record<string, unknown>) =>
      request<unknown>('/v1/agents', { method: 'POST', body }),
    updateAgent: (id: string, body: Record<string, unknown>) =>
      request<unknown>(`/v1/agents/${id}`, { method: 'PUT', body }),
    deleteAgent: (id: string) =>
      request<unknown>(`/v1/agents/${id}`, { method: 'DELETE' }),
    listProviders: () => request<unknown>('/v1/providers'),
    createProvider: (body: Record<string, unknown>) =>
      request<unknown>('/v1/providers', { method: 'POST', body }),
    updateProvider: (id: string, body: Record<string, unknown>) =>
      request<unknown>(`/v1/providers/${id}`, { method: 'PUT', body }),
    deleteProvider: (id: string) =>
      request<unknown>(`/v1/providers/${id}`, { method: 'DELETE' }),
    verifyProvider: (id: string) =>
      request<unknown>(`/v1/providers/${id}/verify`, { method: 'POST' }),
    listChannelInstances: () => request<unknown>('/v1/channels/instances'),
    createChannelInstance: (body: Record<string, unknown>) =>
      request<unknown>('/v1/channels/instances', { method: 'POST', body }),
    updateChannelInstance: (id: string, body: Record<string, unknown>) =>
      request<unknown>(`/v1/channels/instances/${id}`, {
        method: 'PUT',
        body
      }),
    deleteChannelInstance: (id: string) =>
      request<unknown>(`/v1/channels/instances/${id}`, {
        method: 'DELETE'
      }),
    chatCompletions: (body: Record<string, unknown>) =>
      request<unknown>('/v1/chat/completions', { method: 'POST', body }),
    getUsageBreakdown: (query: string) =>
      request<unknown>(`/v1/usage/breakdown?${query}`),
    getEdition: () => request<unknown>('/v1/edition'),
    listTeams: () => request<unknown>('/v1/teams'),
    getTeamEvents: (teamId: string, query?: string) =>
      request<unknown>(
        `/v1/teams/${teamId}/events${query ? `?${query}` : ''}`
      ),
    importTeamArchive: async (formData: FormData) => {
      const url = `${base}/v1/teams/import`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchFn(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.bearerToken}`,
            'X-GoClaw-User-Id': config.userId
          },
          body: formData,
          signal: controller.signal
        });
        const text = await res.text();
        if (!res.ok) {
          throw new GoclawHttpError(
            `GoClaw HTTP ${res.status} /v1/teams/import`,
            res.status,
            text
          );
        }
        return text ? (JSON.parse(text) as unknown) : undefined;
      } finally {
        clearTimeout(t);
      }
    },
    listMcpServers: () => request<unknown>('/v1/mcp/servers'),
    createMcpServer: (body: Record<string, unknown>) =>
      request<unknown>('/v1/mcp/servers', { method: 'POST', body }),
    getMcpServer: (id: string) => request<unknown>(`/v1/mcp/servers/${id}`),
    putMcpUserCredentials: (serverId: string, body: Record<string, unknown>) =>
      request<unknown>(`/v1/mcp/servers/${serverId}/user-credentials`, {
        method: 'PUT',
        body
      }),
    postMcpServerAgentGrant: (
      serverId: string,
      body: Record<string, unknown>
    ) =>
      request<unknown>(`/v1/mcp/servers/${serverId}/grants/agent`, {
        method: 'POST',
        body
      }),
    /** Fallback when the nested grants path is unavailable on older gateways. */
    createMcpGrant: (body: Record<string, unknown>) =>
      request<unknown>('/v1/mcp/grants', { method: 'POST', body }),
    listMcpServerTools: (serverId: string) =>
      request<unknown>(`/v1/mcp/servers/${serverId}/tools`)
  };
}

export type GoclawClient = ReturnType<typeof createGoclawClient>;

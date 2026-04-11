/**
 * Optional adapter for provisioning isolated GoClaw runtimes (e.g. one Droplet per org).
 * Implement in a worker service; the dashboard can enqueue jobs that call this interface.
 */
export type OrchestratorProvisionInput = {
  organizationId: string;
  organizationSlug: string;
  region?: string;
};

export type OrchestratorProvisionResult =
  | { ok: true; baseUrl: string; gatewayTokenHint?: string }
  | { ok: false; message: string };

export type OrchestratorAdapter = {
  provisionRuntime(
    input: OrchestratorProvisionInput
  ): Promise<OrchestratorProvisionResult>;
  destroyRuntime(organizationId: string): Promise<{ ok: true } | { ok: false; message: string }>;
};

/**
 * GoClaw tool presets (see plan/go-claw-full-docs/core-concepts/tools-overview.md).
 */
export const GOCLAW_TOOL_PROFILES = [
  'full',
  'coding',
  'messaging',
  'minimal'
] as const;

export type GoclawToolProfile = (typeof GOCLAW_TOOL_PROFILES)[number];

/**
 * Maps UI selection to `agents.tools_config` JSON (REST `tools_config` body field).
 * Aligns with global `tools.profile` in configuration.md.
 */
export function buildToolsConfigFromProfile(
  profile: GoclawToolProfile
): Record<string, unknown> {
  return { profile };
}

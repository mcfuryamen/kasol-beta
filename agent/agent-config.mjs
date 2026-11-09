/** Shared agent profile resolver for runner handlers. */
const DEFAULTS = { model: "auto/best-fast", persona: "profesional", arahan: "", variasi: 1 };

export async function loadAgentConfig(sbFetch) {
  const rows = await sbFetch("/rest/v1/settings?key=in.(agent_config,agents)&select=key,value");
  const global = (Array.isArray(rows) ? rows.find((r) => r.key === "agent_config")?.value : null) || {};
  const raw = (Array.isArray(rows) ? rows.find((r) => r.key === "agents")?.value : null);
  const agents = Array.isArray(raw) ? raw : [];
  return { global, agents };
}

export function resolveAgentProfile(config, agentId) {
  const profile = config.agents.find((a) => a.id === agentId) || null;
  if (profile?.aktif === false) throw new Error(`[NON-RETRYABLE] agent nonaktif: ${profile.nama || profile.id}`);
  return {
    profile,
    model: profile?.model || config.global.model || DEFAULTS.model,
    persona: profile?.persona || config.global.persona || DEFAULTS.persona,
    arahan: profile?.arahan || config.global.arahanGlobal || DEFAULTS.arahan,
    variasi: Math.min(3, Math.max(1, Number(profile?.variasi || config.global.variasi || DEFAULTS.variasi))),
  };
}

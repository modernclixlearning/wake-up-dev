/** Configuración BYOK (bring your own key) persistida en localStorage del jugador. */

export type ProviderId = "ninguno" | "anthropic" | "openai" | "gemini" | "claude-headless";

export interface AIConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export const MODELOS_DEFAULT: Record<Exclude<ProviderId, "ninguno">, string> = {
  anthropic: "claude-opus-4-8",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  // El headless usa el modelo configurado en el CLI local (BRIDGE_CLAUDE_ARGS del bridge).
  "claude-headless": "",
};

const STORAGE_KEY = "wake-up-dev:ai-config";

const CONFIG_VACIA: AIConfig = { provider: "ninguno", apiKey: "", model: "" };

export function cargarConfig(storage: Storage = localStorage): AIConfig {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...CONFIG_VACIA };
    const data = JSON.parse(raw) as Partial<AIConfig>;
    return {
      provider: data.provider ?? "ninguno",
      apiKey: data.apiKey ?? "",
      model: data.model ?? "",
    };
  } catch {
    return { ...CONFIG_VACIA };
  }
}

export function guardarConfig(config: AIConfig, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function configCompleta(config: AIConfig): boolean {
  if (config.provider === "ninguno") return false;
  // El bridge headless usa la sesión local del CLI: no necesita API key.
  if (config.provider === "claude-headless") return true;
  return config.apiKey.trim() !== "";
}

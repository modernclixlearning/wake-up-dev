import { AnthropicAdapter } from "./anthropic-adapter";
import { BridgeAdapter } from "./bridge-adapter";
import { AIConfig, MODELOS_DEFAULT, configCompleta } from "./config";
import { GeminiAdapter } from "./gemini-adapter";
import { OpenAIAdapter } from "./openai-adapter";
import { ProxyAdapter } from "./proxy-adapter";
import { AIProvider } from "./provider";
import { StaticFallback } from "./static-fallback";

/** Resuelve el provider activo según la config BYOK; sin key válida cae al fallback estático. */
export function crearProvider(config: AIConfig): AIProvider {
  if (!configCompleta(config)) return new StaticFallback();
  const model = config.model.trim() || MODELOS_DEFAULT[config.provider as keyof typeof MODELOS_DEFAULT];
  switch (config.provider) {
    case "proxy":
      return new ProxyAdapter();
    case "anthropic":
      return new AnthropicAdapter(config.apiKey, model);
    case "openai":
      return new OpenAIAdapter(config.apiKey, model);
    case "gemini":
      return new GeminiAdapter(config.apiKey, model);
    case "claude-headless":
      return new BridgeAdapter("claude");
    case "copilot-headless":
      return new BridgeAdapter("copilot");
    default:
      return new StaticFallback();
  }
}

export function hayIA(provider: AIProvider): boolean {
  return provider.nombre !== "static-fallback";
}

/**
 * Sonda el proxy en background y, si está disponible, llama a `alCambiar` con un ProxyAdapter.
 * Solo actúa cuando no hay config guardada en localStorage (provider "ninguno").
 * No guarda nada en localStorage: es una decisión de arranque, no una preferencia del jugador.
 * Degrada en silencio si el GET falla, tarda o devuelve disponible:false.
 */
export function activarProxySiDisponible(
  alCambiar: (p: AIProvider) => void,
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): void {
  const proxy = new ProxyAdapter(fetchImpl);
  proxy
    .disponible()
    .then((disponible) => {
      if (disponible) alCambiar(proxy);
    })
    .catch(() => {
      // Degradar en silencio: el fallback estático sigue activo.
    });
}

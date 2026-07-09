import { AnthropicAdapter } from "./anthropic-adapter";
import { ClaudeHeadlessAdapter } from "./claude-headless-adapter";
import { AIConfig, MODELOS_DEFAULT, configCompleta } from "./config";
import { GeminiAdapter } from "./gemini-adapter";
import { OpenAIAdapter } from "./openai-adapter";
import { AIProvider } from "./provider";
import { StaticFallback } from "./static-fallback";

/** Resuelve el provider activo según la config BYOK; sin key válida cae al fallback estático. */
export function crearProvider(config: AIConfig): AIProvider {
  if (!configCompleta(config)) return new StaticFallback();
  const model = config.model.trim() || MODELOS_DEFAULT[config.provider as keyof typeof MODELOS_DEFAULT];
  switch (config.provider) {
    case "anthropic":
      return new AnthropicAdapter(config.apiKey, model);
    case "openai":
      return new OpenAIAdapter(config.apiKey, model);
    case "gemini":
      return new GeminiAdapter(config.apiKey, model);
    case "claude-headless":
      return new ClaudeHeadlessAdapter();
    default:
      return new StaticFallback();
  }
}

export function hayIA(provider: AIProvider): boolean {
  return provider.nombre !== "static-fallback";
}

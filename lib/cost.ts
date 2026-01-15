import { CONFIG } from "./config";

export function approxTokens(text: string, approxCharsPerToken = CONFIG.chunking.approxCharsPerToken): number {
  const chars = Math.max(0, text.length);
  return Math.ceil(chars / Math.max(1, approxCharsPerToken));
}

export function costUsd(tokens: number, usdPer1M: number): number {
  if (!usdPer1M) return 0;
  return (tokens / 1_000_000) * usdPer1M;
}

export function estimateEmbeddingCostUsd(texts: string[]): { approxTokens: number; approxCostUsd: number } {
  const t = texts.reduce((acc, x) => acc + approxTokens(x), 0);
  return { approxTokens: t, approxCostUsd: costUsd(t, CONFIG.pricing.embedUsdPer1M) };
}

export function estimateLlmCostUsd(promptTokens: number, completionTokens: number): number {
  const p = costUsd(promptTokens, CONFIG.pricing.promptUsdPer1M);
  const c = costUsd(completionTokens, CONFIG.pricing.completionUsdPer1M);
  return p + c;
}

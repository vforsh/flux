export function redactApiKey(apiKey: string | undefined | null): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return "***";
  return `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`;
}


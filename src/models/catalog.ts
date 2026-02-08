export type ModelFamily = "flux2" | "kontext" | "flux11" | "flux11ultra" | "fill" | "expand" | "unknown";

export type ModelSpec = {
  key: string;
  family: ModelFamily;
  apiPath: string; // POST /v1/<apiPath>
  maxInputs?: number;
  notes?: string;
};

export const DEFAULT_MODEL = "flux-2-pro";

export const MODEL_SPECS: ReadonlyArray<ModelSpec> = [
  { key: "flux-2-pro", family: "flux2", apiPath: "flux-2-pro", maxInputs: 8 },
  { key: "flux-2-flex", family: "flux2", apiPath: "flux-2-flex", maxInputs: 8, notes: "supports steps/guidance" },
  { key: "flux-2-max", family: "flux2", apiPath: "flux-2-max", maxInputs: 8 },
  { key: "flux-2-klein-4b", family: "flux2", apiPath: "flux-2-klein-4b", maxInputs: 8 },
  { key: "flux-2-klein-9b", family: "flux2", apiPath: "flux-2-klein-9b", maxInputs: 8 },

  { key: "flux-kontext-pro", family: "kontext", apiPath: "flux-kontext-pro", maxInputs: 4 },
  { key: "flux-kontext-max", family: "kontext", apiPath: "flux-kontext-max", maxInputs: 4 },

  { key: "flux-pro-1.1", family: "flux11", apiPath: "flux-pro-1.1" },
  { key: "flux-pro-1.1-ultra", family: "flux11ultra", apiPath: "flux-pro-1.1-ultra" },

  // Editing tools
  { key: "flux-pro-1.0-fill", family: "fill", apiPath: "flux-pro-1.0-fill" },
  { key: "flux-pro-1.0-expand", family: "expand", apiPath: "flux-pro-1.0-expand" },

  // Exposed in docs but request shape isn't standardized across model generations.
  { key: "flux-dev", family: "unknown", apiPath: "flux-dev", notes: "use --body for full control" },
  { key: "flux-pro", family: "unknown", apiPath: "flux-pro", notes: "use --body for full control" },
];

export function getModelSpec(key: string): ModelSpec | undefined {
  return MODEL_SPECS.find((m) => m.key === key);
}


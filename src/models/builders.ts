import { CliError } from "../cli/errors.ts";
import { isHttpUrl } from "../util/url.ts";
import { getModelSpec, type ModelSpec } from "./catalog.ts";

export type OutputFormat = "jpeg" | "png";

export type GenArgs = {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  aspect?: string;
  seed?: number;
  safety?: number;
  format?: OutputFormat;
  steps?: number;
  guidance?: number;
  promptUpsampling?: boolean;
  raw?: boolean;
  imagePrompt?: string;
  imagePromptStrength?: number;
  webhookUrl?: string;
  webhookSecret?: string;
};

export type EditArgs = Omit<GenArgs, "width" | "height" | "aspect" | "raw" | "imagePrompt" | "imagePromptStrength"> & {
  inputs: string[];
  width?: number;
  height?: number;
  aspect?: string;
};

export type FillArgs = {
  prompt: string;
  imageBase64: string;
  maskBase64?: string;
  steps?: number;
  guidance?: number;
  safety?: number;
  seed?: number;
  format?: OutputFormat;
};

export type ExpandArgs = {
  prompt: string;
  imageBase64: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  steps?: number;
  guidance?: number;
  safety?: number;
  seed?: number;
  format?: OutputFormat;
};

export function requireKnownModel(key: string): ModelSpec {
  const spec = getModelSpec(key);
  if (!spec) throw new CliError(`Unknown model: ${key}`, { exitCode: 2 });
  return spec;
}

export function buildGenBody(args: GenArgs): { modelPath: string; body: Record<string, unknown> } {
  const spec = requireKnownModel(args.model);
  const base = commonBody(args);

  if (spec.family === "flux2") {
    const { width, height } = normalizeDims(args.width, args.height, { multiple: 16, min: 64, maxMp: 4_000_000 });
    const body: Record<string, unknown> = { ...base, width, height };
    if (spec.key === "flux-2-flex") {
      if (args.steps != null) body.steps = args.steps;
      if (args.guidance != null) body.guidance = args.guidance;
    }
    return { modelPath: spec.apiPath, body };
  }

  if (spec.family === "flux11") {
    const { width, height } = normalizeDims(args.width, args.height, { multiple: 32, min: 256, max: 1440 });
    return { modelPath: spec.apiPath, body: { ...base, width, height } };
  }

  if (spec.family === "flux11ultra") {
    const aspect_ratio = args.aspect ?? "1:1";
    const body: Record<string, unknown> = { ...base, aspect_ratio };
    if (args.raw != null) body.raw = args.raw;
    if (args.imagePrompt) {
      body.image_prompt = args.imagePrompt;
      if (args.imagePromptStrength != null) body.image_prompt_strength = args.imagePromptStrength;
    }
    return { modelPath: spec.apiPath, body };
  }

  if (spec.family === "kontext") {
    const aspect_ratio = args.aspect;
    const body: Record<string, unknown> = { ...base };
    if (aspect_ratio) body.aspect_ratio = aspect_ratio;
    if (args.promptUpsampling != null) body.prompt_upsampling = args.promptUpsampling;
    return { modelPath: spec.apiPath, body };
  }

  throw new CliError(`Model not supported by gen builder: ${args.model} (use --body)`, { exitCode: 2 });
}

export function buildEditBody(args: EditArgs): { modelPath: string; body: Record<string, unknown> } {
  const spec = requireKnownModel(args.model);
  const base = commonBody(args);

  const maxInputs = spec.maxInputs ?? 1;
  if (args.inputs.length < 1) throw new CliError("--input is required (at least 1)", { exitCode: 2 });
  if (args.inputs.length > maxInputs) throw new CliError(`Too many --input values for ${spec.key} (max ${maxInputs})`, { exitCode: 2 });

  const body: Record<string, unknown> = { ...base };
  for (let i = 0; i < args.inputs.length; i++) {
    const k = i === 0 ? "input_image" : `input_image_${i + 1}`;
    body[k] = args.inputs[i];
  }

  if (args.width != null || args.height != null) {
    if (spec.family === "flux2") {
      const { width, height } = normalizeDims(args.width, args.height, { multiple: 16, min: 64, maxMp: 4_000_000 });
      body.width = width;
      body.height = height;
    } else if (spec.family === "flux11") {
      const { width, height } = normalizeDims(args.width, args.height, { multiple: 32, min: 256, max: 1440 });
      body.width = width;
      body.height = height;
    }
  }
  if (args.aspect && spec.family === "kontext") body.aspect_ratio = args.aspect;
  if (args.promptUpsampling != null && spec.family === "kontext") body.prompt_upsampling = args.promptUpsampling;

  if (spec.family !== "flux2" && spec.family !== "kontext" && spec.family !== "flux11") {
    throw new CliError(`Model not supported by edit builder: ${args.model} (use --body)`, { exitCode: 2 });
  }

  // Sanity: FLUX API accepts base64 or URL for input_image fields. If user provided local paths,
  // caller should have already encoded them.
  for (const v of args.inputs) {
    if (typeof v !== "string" || v.length === 0) throw new CliError("Invalid --input value", { exitCode: 2 });
    if (!isHttpUrl(v) && !looksLikeBase64(v)) {
      // Not a hard error (future formats), but almost certainly a mistake at this layer.
      throw new CliError("Internal: edit inputs must be base64 or URL (did you forget to encode?)", { exitCode: 2 });
    }
  }

  return { modelPath: spec.apiPath, body };
}

export function buildFillBody(args: FillArgs): { modelPath: string; body: Record<string, unknown> } {
  const body: Record<string, unknown> = {
    prompt: args.prompt,
    image: args.imageBase64,
  };
  if (args.maskBase64) body.mask = args.maskBase64;
  if (args.steps != null) body.steps = args.steps;
  if (args.guidance != null) body.guidance = args.guidance;
  if (args.safety != null) body.safety_tolerance = args.safety;
  if (args.seed != null) body.seed = args.seed;
  if (args.format) body.output_format = args.format;
  return { modelPath: "flux-pro-1.0-fill", body };
}

export function buildExpandBody(args: ExpandArgs): { modelPath: string; body: Record<string, unknown> } {
  const body: Record<string, unknown> = {
    prompt: args.prompt,
    image: args.imageBase64,
  };
  if (args.top != null) body.top = args.top;
  if (args.bottom != null) body.bottom = args.bottom;
  if (args.left != null) body.left = args.left;
  if (args.right != null) body.right = args.right;
  if (args.steps != null) body.steps = args.steps;
  if (args.guidance != null) body.guidance = args.guidance;
  if (args.safety != null) body.safety_tolerance = args.safety;
  if (args.seed != null) body.seed = args.seed;
  if (args.format) body.output_format = args.format;
  return { modelPath: "flux-pro-1.0-expand", body };
}

function commonBody(args: { prompt: string; seed?: number; safety?: number; format?: OutputFormat; webhookUrl?: string; webhookSecret?: string }): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: args.prompt };
  if (args.seed != null) body.seed = args.seed;
  if (args.safety != null) body.safety_tolerance = args.safety;
  if (args.format) body.output_format = args.format;
  if (args.webhookUrl) body.webhook_url = args.webhookUrl;
  if (args.webhookSecret) body.webhook_secret = args.webhookSecret;
  return body;
}

function normalizeDims(
  width: number | undefined,
  height: number | undefined,
  rules: { multiple: number; min: number; max?: number; maxMp?: number },
): { width: number; height: number } {
  const w = width ?? 1024;
  const h = height ?? 1024;
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw new CliError("width/height must be numbers", { exitCode: 2 });
  if (!Number.isInteger(w) || !Number.isInteger(h)) throw new CliError("width/height must be integers", { exitCode: 2 });
  if (w < rules.min || h < rules.min) throw new CliError(`width/height must be >= ${rules.min}`, { exitCode: 2 });
  if (rules.max != null && (w > rules.max || h > rules.max)) throw new CliError(`width/height must be <= ${rules.max}`, { exitCode: 2 });
  if (w % rules.multiple !== 0 || h % rules.multiple !== 0) {
    throw new CliError(`width/height must be multiples of ${rules.multiple}`, { exitCode: 2 });
  }
  if (rules.maxMp != null && w * h > rules.maxMp) {
    throw new CliError(`width*height must be <= ${rules.maxMp} pixels`, { exitCode: 2 });
  }
  return { width: w, height: h };
}

function looksLikeBase64(s: string): boolean {
  // Rough heuristic; we mostly need to detect local file paths.
  if (s.length < 64) return false;
  // data: URLs are allowed too.
  if (s.startsWith("data:")) return true;
  return /^[A-Za-z0-9+/=\n\r]+$/.test(s);
}


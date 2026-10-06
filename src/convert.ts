export const FORMATS = ["png", "jpg", "webp"] as const;
export type Format = (typeof FORMATS)[number];
export type Unit = "px" | "x";

export type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type ConvertSettings = {
  width: number;
  widthUnit: Unit;
  height: number;
  heightUnit: Unit;
  format: Format;
  color: Rgba;
};

export const MAX_EDGE = 16_384;
export const MAX_PIXELS = 48_000_000;

const MIME: Record<Format, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const FORMAT_LABEL: Record<Format, string> = {
  png: "PNG",
  jpg: "JPG",
  webp: "WebP",
};

export type FieldState = "ok" | "partial" | "invalid";

export function isFormat(value: string): value is Format {
  return (FORMATS as readonly string[]).includes(value);
}

export function isUnit(value: string): value is Unit {
  return value === "px" || value === "x";
}

export function numberState(input: string): FieldState {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === "." || /^\d+\.$/.test(trimmed)) return "partial";
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return "invalid";
  return Number(trimmed) > 0 ? "ok" : "invalid";
}

export function hexState(input: string): FieldState {
  const trimmed = input.trim();
  if (!/^#?[0-9a-f]*$/i.test(trimmed)) return "invalid";
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (hex.length === 3 || hex.length === 4 || hex.length === 6 || hex.length === 8) {
    return "ok";
  }
  return hex.length < 8 ? "partial" : "invalid";
}

export function parsePositive(input: string): number | null {
  if (numberState(input) !== "ok") return null;
  return Number(input.trim());
}

export function parseHexColor(input: string): Rgba | null {
  if (hexState(input) !== "ok") return null;
  const hex = input.trim().replace(/^#/, "");
  const full = hex.length <= 4 ? expandShorthand(hex) : hex;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) : 255,
  };
}

export function canvasColor(color: Rgba): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${color.a / 255})`;
}

export function settingsErrorMessage(input: {
  width: string;
  height: string;
  background: string;
}): string | null {
  if (numberState(input.width) === "invalid" || numberState(input.height) === "invalid") {
    return "Enter a positive number for width and height.";
  }
  if (hexState(input.background) === "invalid") {
    return "Background must be a 3, 4, 6, or 8 digit hex color.";
  }
  return null;
}

export function readSettings(input: {
  width: string;
  widthUnit: Unit;
  height: string;
  heightUnit: Unit;
  format: Format;
  background: string;
}): ConvertSettings | null {
  const width = parsePositive(input.width);
  const height = parsePositive(input.height);
  const color = parseHexColor(input.background);
  if (width == null || height == null || color == null) return null;
  return {
    width,
    widthUnit: input.widthUnit,
    height,
    heightUnit: input.heightUnit,
    format: input.format,
    color,
  };
}

export function resolvePixels(value: number, unit: Unit, natural: number): number | null {
  const px = unit === "px" ? value : natural * value;
  if (!Number.isFinite(px)) return null;
  const rounded = Math.round(px);
  return rounded >= 1 ? rounded : null;
}

export function planSize(
  naturalWidth: number,
  naturalHeight: number,
  settings: Pick<ConvertSettings, "width" | "widthUnit" | "height" | "heightUnit">,
): { width: number; height: number } | { error: string } {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    return { error: "Could not read the image size." };
  }
  const width = resolvePixels(settings.width, settings.widthUnit, naturalWidth);
  const height = resolvePixels(settings.height, settings.heightUnit, naturalHeight);
  if (width == null || height == null) {
    return { error: "Width and height must be at least 1px." };
  }
  if (width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
    return {
      error: `That size is too large. Each side must be ${MAX_EDGE}px or less, and the total must be ${MAX_PIXELS / 1_000_000} million pixels or less.`,
    };
  }
  return { width, height };
}

function expandShorthand(hex: string): string {
  let full = "";
  for (let index = 0; index < hex.length; index += 1) {
    const digit = hex.charAt(index);
    full += digit + digit;
  }
  return full;
}

function stripControls(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) >= 32) out += value.charAt(index);
  }
  return out;
}

export function outputName(filename: string, format: Format): string {
  const leaf = filename.split(/[/\\]/).pop() ?? "";
  const trimmed = stripControls(leaf).trim();
  const dot = trimmed.lastIndexOf(".");
  const stem = (dot > 0 ? trimmed.slice(0, dot) : trimmed).trim();
  return `${stem || "image"}.${format}`;
}

function unsupportedMessage(format: Format): string {
  return `This browser cannot write ${FORMAT_LABEL[format]} with toDataURL().`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  return image.decode().then(
    () => {
      URL.revokeObjectURL(url);
      return image;
    },
    () => {
      URL.revokeObjectURL(url);
      throw new Error("Could not read this image.");
    },
  );
}

export async function convertFile(
  file: File,
  settings: ConvertSettings,
): Promise<{ href: string; name: string }> {
  const image = await loadImage(file);
  const planned = planSize(image.naturalWidth, image.naturalHeight, settings);
  if ("error" in planned) throw new Error(planned.error);

  const canvas = document.createElement("canvas");
  canvas.width = planned.width;
  canvas.height = planned.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = canvasColor(settings.color);
  ctx.fillRect(0, 0, planned.width, planned.height);
  ctx.drawImage(image, 0, 0, planned.width, planned.height);

  const mime = MIME[settings.format];
  let href: string;
  try {
    href = canvas.toDataURL(mime);
  } catch {
    throw new Error(unsupportedMessage(settings.format));
  }
  if (!href.startsWith(`data:${mime}`)) {
    throw new Error(unsupportedMessage(settings.format));
  }
  return { href, name: outputName(file.name, settings.format) };
}

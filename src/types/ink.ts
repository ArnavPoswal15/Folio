/** Prose ink tone identifiers selectable on each journal spread. */
export type InkColorId = 'charcoal' | 'midnight' | 'sepia';

/** All stylus and drawing tool modes, including the stroke eraser. */
export type InkToolType = 'pen' | 'fountain' | 'highlighter' | 'eraser';

/** Drawing tools that persist strokes onto the ink canvas. */
export type InkDrawToolType = 'pen' | 'fountain' | 'highlighter';

/** Six-color palette identifiers for stylus and highlighter strokes. */
export type InkPaletteId =
  | 'charcoal'
  | 'midnight'
  | 'sepia'
  | 'burgundy'
  | 'sage'
  | 'amber';

/** Discrete stroke thickness presets (1 = Fine, 2 = Medium, 3 = Bold). */
export type InkWidthPreset = 1 | 2 | 3;

/** Quantized point tuple: [x (0..10000), y (0..10000), pressure (0..100)]. */
export type InkPoint = [number, number, number];

/** Deserialized stylus or highlighter stroke stored on a page. */
export interface InkStroke {
  id: string;
  tool: InkDrawToolType;
  color: InkPaletteId;
  width: InkWidthPreset;
  points: InkPoint[];
}

/** Compact single-character tool code used in serialized ink payloads. */
export type CompactToolCode = 'p' | 'f' | 'h';

/** Compact single-character color code used in serialized ink payloads. */
export type CompactColorCode = 'c' | 'm' | 's' | 'b' | 'g' | 'a';

/** Compact tuple encoding of a single stroke for JSON serialization. */
export type CompactStrokeTuple = [
  string,
  CompactToolCode,
  CompactColorCode,
  InkWidthPreset,
  number[],
];

/** Versioned compact JSON document stored in leftInk / rightInk strings. */
export interface CompactInkDoc {
  v: 1;
  s: CompactStrokeTuple[];
}

/** Result returned by serializeInkStrokes indicating quota trimming state. */
export interface InkSerializationResult {
  encoded: string;
  atCapacity: boolean;
}

/** Resolved canvas rendering color, alpha, and compositing mode for a stroke. */
export interface ResolvedStrokeStyle {
  hex: string;
  alpha: number;
  composite: GlobalCompositeOperation;
}

/** Active stylus tool configuration passed from workspace state into ink layers. */
export interface InkToolConfig {
  tool: InkToolType;
  color: InkPaletteId;
  width: InkWidthPreset;
  drawArmed: boolean;
  allowTouchDraw: boolean;
}

/** Mutable runtime tracking state for the currently active pointer stroke or eraser drag. */
export interface ActiveInkPointerState {
  pointerId: number;
  pointerType: string;
  effectiveTool: InkToolType;
  lastNormX: number;
  lastNormY: number;
  lastClientX: number;
  lastClientY: number;
  lastTimeMs: number;
  smoothedVel: number;
  smoothedPressure: number;
  initialRawPressure: number;
  hasHardwarePressure: boolean;
  erasedAny: boolean;
}

/** Metadata descriptor for a palette swatch in light and dark modes. */
export interface InkPaletteEntry {
  label: string;
  lightHex: string;
  darkHex: string;
  lightHighlighter: string;
  darkHighlighter: string;
}

/** Metadata descriptor for a typed prose ink tone. */
export interface ProseInkColorEntry {
  label: string;
  hex: string;
  swatch: string;
  darkHex: string;
  darkSwatch: string;
}

/** Toolbar tool button descriptor without UI icon coupling. */
export interface InkToolMeta {
  id: InkToolType;
  label: string;
}

/** Toolbar width preset descriptor. */
export interface InkWidthMeta {
  id: InkWidthPreset;
  label: string;
  dotPx: number;
}

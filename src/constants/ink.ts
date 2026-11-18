import {
  InkColorId,
  InkPaletteEntry,
  InkPaletteId,
  InkToolConfig,
  InkToolMeta,
  InkWidthMeta,
  ProseInkColorEntry,
} from '../types/ink';
import {
  CompactColorCode,
  CompactToolCode,
  InkDrawToolType,
  InkWidthPreset,
} from '../types/ink';

/** Maximum normalized grid coordinate along X and Y axes for stored ink points. */
export const INK_GRID_MAX = 10000;

/** Normalized grid radius used when hit-testing stroke eraser drags. */
export const INK_ERASER_RADIUS_NORM = 190;

/** Extra eraser padding added around translucent highlighter strokes. */
export const INK_HIGHLIGHTER_ERASE_PAD = 140;

/** Multiplier applied to stroke width preset for non-highlighter erase tolerance. */
export const INK_PEN_ERASE_WIDTH_MULT = 24;

/** Minimum normalized point distance required before appending a new stroke point. */
export const INK_MIN_POINT_STEP = {
  fountain: 12,
  default: 8,
} as const;

/** RDP geometric simplification tolerance in normalized coordinates. */
export const INK_RDP_EPSILON = 11;

/** RDP pressure deviation tolerance preserved for calligraphic fountain strokes. */
export const INK_RDP_PRESSURE_TOLERANCE = 13;

/** Speed-to-pressure curve parameters for fountain nib calligraphy simulation. */
export const FOUNTAIN_PRESSURE_CONFIG = {
  initialDefaultPressure: 46,
  hardwarePressureDetectDelta: 0.015,
  hardwareMoveDetectDelta: 0.02,
  minStepPx: 0.45,
  minDtMs: 4,
  maxDtMs: 80,
  initialVel: 0.35,
  velSmoothOld: 0.65,
  velSmoothNew: 0.35,
  speedMinPxPerMs: 0.1,
  speedRangePxPerMs: 1.35,
  minPressure: 14,
  pressureSpan: 78,
  pressureExponent: 1.35,
  hwPressureWeight: 0.78,
  velPressureWeight: 0.22,
  pressureSmoothRatio: 0.5,
  releaseFlickMinVel: 0.65,
  releaseTaperFactor: 0.68,
  releaseTaperMinPressure: 10,
  nibCantAngleRad: -0.66,
  defaultNonFountainPressure: 55,
  minPointPressure: 8,
  maxPointPressure: 100,
} as const;

/** Base stroke widths in reference 400px-wide page pixels indexed by tool and preset. */
export const INK_BASE_WIDTH_PX: Record<
  InkDrawToolType,
  Record<InkWidthPreset, number>
> = {
  highlighter: { 1: 12, 2: 18, 3: 25 },
  fountain: { 1: 1.9, 2: 2.9, 3: 4.3 },
  pen: { 1: 1.4, 2: 2.2, 3: 3.4 },
};

/** Three prose ink tone definitions selectable per spread header. */
export const INK_COLORS: Record<InkColorId, ProseInkColorEntry> = {
  charcoal: {
    label: 'Charcoal Ink',
    hex: '#24201c',
    swatch: '#2a2520',
    darkHex: '#e8dfd1',
    darkSwatch: '#dcd1bf',
  },
  midnight: {
    label: 'Fountain Blue',
    hex: '#1c3554',
    swatch: '#224268',
    darkHex: '#9bbce8',
    darkSwatch: '#85abde',
  },
  sepia: {
    label: 'Warm Sepia',
    hex: '#57361e',
    swatch: '#6b4226',
    darkHex: '#deb488',
    darkSwatch: '#d4a472',
  },
};

/** Ordered prose ink tone identifiers. */
export const INK_COLOR_ORDER: InkColorId[] = ['charcoal', 'midnight', 'sepia'];

/** Six stylus drawing color definitions for light and dark themes. */
export const INK_PALETTE: Record<InkPaletteId, InkPaletteEntry> = {
  charcoal: {
    label: 'Charcoal Ink',
    lightHex: '#24201c',
    darkHex: '#e8dfd1',
    lightHighlighter: '#a99e8e',
    darkHighlighter: '#b9ac99',
  },
  midnight: {
    label: 'Fountain Blue',
    lightHex: '#1c3554',
    darkHex: '#9bbce8',
    lightHighlighter: '#6f9ad0',
    darkHighlighter: '#7baae6',
  },
  sepia: {
    label: 'Warm Sepia',
    lightHex: '#57361e',
    darkHex: '#deb488',
    lightHighlighter: '#c6935f',
    darkHighlighter: '#d9a774',
  },
  burgundy: {
    label: 'Burgundy Ribbon',
    lightHex: '#7a222b',
    darkHex: '#e4838a',
    lightHighlighter: '#d46b74',
    darkHighlighter: '#e07b82',
  },
  sage: {
    label: 'Olive Sage',
    lightHex: '#315238',
    darkHex: '#8db894',
    lightHighlighter: '#75a37b',
    darkHighlighter: '#84b58b',
  },
  amber: {
    label: 'Warm Amber',
    lightHex: '#b27514',
    darkHex: '#eab85b',
    lightHighlighter: '#e5b242',
    darkHighlighter: '#eab85b',
  },
};

/** Ordered palette identifiers displayed in the floating ink toolbar. */
export const INK_PALETTE_ORDER: InkPaletteId[] = [
  'charcoal',
  'midnight',
  'sepia',
  'burgundy',
  'sage',
  'amber',
];

/** Compact encoding map from drawing tool name to single-letter code. */
export const TOOL_TO_CODE: Record<InkDrawToolType, CompactToolCode> = {
  pen: 'p',
  fountain: 'f',
  highlighter: 'h',
};

/** Compact decoding map from single-letter code to drawing tool name. */
export const CODE_TO_TOOL: Record<CompactToolCode, InkDrawToolType> = {
  p: 'pen',
  f: 'fountain',
  h: 'highlighter',
};

/** Compact encoding map from palette identifier to single-letter code. */
export const COLOR_TO_CODE: Record<InkPaletteId, CompactColorCode> = {
  charcoal: 'c',
  midnight: 'm',
  sepia: 's',
  burgundy: 'b',
  sage: 'g',
  amber: 'a',
};

/** Compact decoding map from single-letter code to palette identifier. */
export const CODE_TO_COLOR: Record<CompactColorCode, InkPaletteId> = {
  c: 'charcoal',
  m: 'midnight',
  s: 'sepia',
  b: 'burgundy',
  g: 'sage',
  a: 'amber',
};

/** Ordered metadata for drawing tool buttons in InkToolbar. */
export const INK_TOOL_ITEMS: InkToolMeta[] = [
  { id: 'pen', label: 'Fine Pen' },
  { id: 'fountain', label: 'Fountain Nib' },
  { id: 'highlighter', label: 'Highlighter' },
  { id: 'eraser', label: 'Stroke Eraser' },
];

/** Ordered metadata for stroke width dot buttons in InkToolbar. */
export const INK_WIDTH_ITEMS: InkWidthMeta[] = [
  { id: 1, label: 'Fine stroke', dotPx: 4 },
  { id: 2, label: 'Medium stroke', dotPx: 7 },
  { id: 3, label: 'Bold stroke', dotPx: 10 },
];

/** Fallback read-only ink tool config used on non-interactive curl/cover pages. */
export const DEFAULT_READONLY_INK_CONFIG: InkToolConfig = {
  tool: 'fountain',
  color: 'charcoal',
  width: 2,
  drawArmed: false,
  allowTouchDraw: false,
};

/** Maximum per-page undo/redo snapshots retained in memory. */
export const INK_HISTORY_MAX_STEPS = 40;

/** Duration (ms) before the clear-all confirmation state automatically resets. */
export const INK_CLEAR_CONFIRM_TIMEOUT_MS = 3000;

/** Duration (ms) before the ink storage capacity toast automatically dismisses. */
export const INK_CAPACITY_WARNING_TIMEOUT_MS = 5000;

/** Maximum device pixel ratio cap when sizing high-DPI ink canvases. */
export const INK_CANVAS_MAX_DPR = 3;

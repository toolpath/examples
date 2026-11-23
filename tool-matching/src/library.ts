import {
  ToolLibrarySchema,
  parametricHolder,
  type Collet,
  type Holder,
  type Tool,
  type ToolLibrary,
} from '@toolpath/tool-support'

/*
  A small shop's tool library, made up for this example: the cutters, holders and collets matching
  may choose from. Nothing outside it is ever offered.

  Matching reads tool-support's shared record (`Tool`, `Holder`, `Collet`), every length in
  millimetres. Your own library comes from somewhere else, such as a vendor catalog, a crib export
  or a Fusion tool library: map each item into these records the way the helpers below do.
*/

const VENDOR = 'Example Tooling'

/** What every cutter here states: what it is, its cutting end and its shank. */
interface CutterSpec {
  id: string
  line: string
  kind: Tool['kind']
  diameter: number
  fluteLength: number
  overallLength: number
  shank?: number
  flutes?: number
  cornerRadius?: number
  tipAngleDeg?: number
  pitch?: number
}

/**
 * A solid cutter as tool-support's record. Its `shaft` is everything above the flutes: here one
 * plain shank to the overall length, which is what tells matching how it is held and how far it
 * reaches.
 */
const cutter = (spec: CutterSpec): Tool => {
  const shank = spec.shank ?? spec.diameter
  return {
    type: 'solid',
    kind: spec.kind,
    guid: spec.id,
    vendor: VENDOR,
    productId: spec.id,
    name: spec.id,
    productLine: spec.line,
    unitSystem: 'millimeters',
    diameter: spec.diameter,
    fluteLength: spec.fluteLength,
    shaft: [
      {
        thickness: spec.overallLength - spec.fluteLength,
        bottomDiameter: shank,
        topDiameter: shank,
      },
    ],
    ...(spec.flutes === undefined ? {} : { fluteCount: spec.flutes }),
    ...(spec.cornerRadius === undefined ? {} : { cornerRadius: spec.cornerRadius }),
    ...(spec.tipAngleDeg === undefined ? {} : { tipAngleDeg: spec.tipAngleDeg }),
    ...(spec.pitch === undefined ? {} : { thread: { pitch: spec.pitch } }),
  }
}

/** A 140° carbide drill, 5 × D of flute. */
const drill = (diameter: number): Tool =>
  cutter({
    id: `DR-${Number(diameter.toFixed(3))}`,
    line: 'Carbide drill 5×D',
    kind: 'DrillBit',
    diameter,
    fluteLength: Math.round(diameter * 5 + 4),
    overallLength: Math.round(diameter * 5 + 4 + 36 + diameter * 2),
    shank: Math.max(3, Math.ceil(diameter)),
    flutes: 2,
    tipAngleDeg: 140,
  })

/** A 90° spot drill. */
const spotDrill = (diameter: number): Tool =>
  cutter({
    id: `SP-${diameter}`,
    line: 'Spot drill 90°',
    kind: 'SpotDrill',
    diameter,
    fluteLength: diameter,
    overallLength: 50 + diameter * 2,
    flutes: 2,
    tipAngleDeg: 90,
  })

/** A metric cutting tap. */
const tap = (major: number, pitch: number, shank: number): Tool =>
  cutter({
    id: `TP-M${major}x${pitch}`,
    line: 'Spiral flute tap',
    kind: 'CuttingTap',
    diameter: major,
    fluteLength: major * 2,
    overallLength: 60 + major * 3,
    shank,
    flutes: 3,
    pitch,
  })

/** A carbide end mill: square (`radius` 0), bull nose or ball. */
const endMill = (
  diameter: number,
  { radius = 0, reach = 'std' }: { radius?: number; reach?: 'std' | 'long' } = {},
): Tool => {
  const ball = radius === diameter / 2
  const kind = ball ? 'BallEndmill' : radius > 0 ? 'RadiusEndmill' : 'FlatEndmill'
  const tag = ball ? 'B' : radius > 0 ? `R${radius}` : 'SQ'
  const long = reach === 'long'
  return cutter({
    id: `EM-${diameter}-${tag}${long ? '-L' : ''}`,
    line: `${ball ? 'Ball' : radius > 0 ? 'Corner radius' : 'Square'} end mill${long ? ', long reach' : ''}`,
    kind,
    diameter,
    fluteLength: Math.round(diameter * (long ? 4 : 2.5)),
    overallLength: Math.round(diameter * (long ? 4 : 2.5) + 40 + diameter * (long ? 4 : 1.5)),
    shank: Math.max(6, diameter),
    flutes: diameter < 6 ? 3 : 4,
    cornerRadius: radius,
  })
}

/** A 90° chamfer mill: its `tipAngleDeg` is the included angle of its cone. */
const chamferMill = (diameter: number): Tool =>
  cutter({
    id: `CH-${diameter}-90`,
    line: 'Chamfer mill 90°',
    kind: 'ChamferEndmill',
    diameter,
    fluteLength: diameter / 2,
    overallLength: 60,
    shank: Math.max(6, diameter),
    flutes: 4,
    tipAngleDeg: 90,
  })

/** An ER32 collet, closing 1 mm under its size; a tap collet floats the tap. */
const collet = (size: number, kind: 'standard' | 'tap' = 'standard'): Collet => ({
  guid: `ER32-${size}${kind === 'tap' ? '-T' : ''}`,
  vendor: VENDOR,
  productId: `ER32-${size}${kind === 'tap' ? '-T' : ''}`,
  series: 'ER32',
  kind,
  clampMin: size - 1,
  clampMax: size,
})

/**
 * A CAT40 ER32 collet chuck. `layers` is its outline, nose first, which matching sweeps against
 * the part to keep the holder clear of it: `parametricHolder` builds one from a few dimensions.
 */
const colletChuck = (gaugeLength: number): Holder => ({
  ...parametricHolder({
    noseDiameter: 50,
    noseLength: gaugeLength - 15,
    bodyDiameter: null,
    bodyLength: null,
    projection: gaugeLength - 15,
    flangeDiameter: 63.5,
    gaugeLength,
  }),
  guid: `CAT40-ER32-${gaugeLength}`,
  vendor: VENDOR,
  productId: `CAT40-ER32-${gaugeLength}`,
  taper: 'CAT40',
  clamping: 'collet',
  colletSeries: 'ER32',
})

export const library: ToolLibrary = ToolLibrarySchema.parse({
  tools: [
    // Metric sizes, and the inch sizes the sample parts ask for.
    ...[1.6, 2, 2.5, 3, 3.3, 3.5, 4, 4.2, 4.5, 5, 5.5, 6, 6.8, 7, 8, 8.5, 10, 10.2, 12, 13.5, 14]
      .concat([1.588, 2.273, 2.778, 7.938, 17.463])
      .sort((a, b) => a - b)
      .map(drill),
    spotDrill(6),
    spotDrill(10),
    tap(4, 0.7, 4.5),
    tap(5, 0.8, 6),
    tap(6, 1, 6),
    tap(8, 1.25, 8),
    tap(10, 1.5, 10),
    ...[1, 2, 3, 4, 6, 8, 10, 12, 16, 20].map((d) => endMill(d)),
    endMill(6, { reach: 'long' }),
    endMill(10, { reach: 'long' }),
    endMill(16, { reach: 'long' }),
    endMill(6, { radius: 0.5 }),
    endMill(10, { radius: 1 }),
    endMill(12, { radius: 2 }),
    endMill(3, { radius: 1.5 }),
    endMill(6, { radius: 3 }),
    endMill(10, { radius: 5 }),
    chamferMill(6),
    chamferMill(12),
  ],
  holders: [colletChuck(70), colletChuck(100)],
  collets: [
    ...Array.from({ length: 18 }, (_, i) => collet(i + 3)),
    ...[4.5, 6, 8, 10].map((size) => collet(size, 'tap')),
  ],
})

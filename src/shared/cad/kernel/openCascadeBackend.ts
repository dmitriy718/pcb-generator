import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import type {
  ConnectorCutout,
  CutoutSide,
  DesignFeature,
  EnclosureProject,
  PcbSpecification,
  TriangleMesh,
  TwoPieceScrewCaseParameters,
  VentilationRegion,
} from '../../domain';
import { getMaterialProfile } from '../../domain/materials';
import { fastenerProfileById, type FastenerProfile } from '../../fasteners';
import { inferPcbFromMechanicalReference } from '../../importers/mechanicalReference';
import { designFeatureFootprints } from '../designFeatureGeometry';
import { triangleArea } from '../meshBuilder';
import { validateMesh } from '../meshValidation';

interface OcShape {
  ShapeType(): unknown;
  Orientation_1(): unknown;
  IsSame(other: OcShape): boolean;
}

interface OcMakeShape {
  Shape(): OcShape;
}

interface OcAnalyzer {
  IsValid_2(): boolean;
  delete?(): void;
}

interface OcStepWriter {
  Transfer(shape: OcShape, mode: unknown, compgraph: boolean): unknown;
  Write(fileName: string): unknown;
  delete?(): void;
}

interface OcStepReader {
  ReadFile(fileName: string): unknown;
  TransferRoots(): number;
  OneShape(): OcShape;
  delete?(): void;
}

interface OcBoundingBox {
  GetXmin(): number;
  GetXmax(): number;
  GetYmin(): number;
  GetYmax(): number;
  GetZmin(): number;
  GetZmax(): number;
  IsVoid(): boolean;
  delete?(): void;
}

interface OcExplorer {
  More(): boolean;
  Current(): OcShape;
  Next(): void;
  delete?(): void;
}

interface OcPoint {
  X(): number;
  Y(): number;
  Z(): number;
  delete?(): void;
}

interface OcTriangle {
  Value(index: 1 | 2 | 3): number;
  delete?(): void;
}

interface OcTriangulation {
  NbNodes(): number;
  NbTriangles(): number;
  Node(index: number): OcPoint;
  Triangle(index: number): OcTriangle;
}

interface OcTriangulationHandle {
  IsNull(): boolean;
  get(): OcTriangulation;
  delete?(): void;
}

interface OcIncrementalMesh {
  IsDone(): boolean;
  delete?(): void;
}

interface OcFileSystem {
  readdir(path: string): string[];
  readFile(path: string, options: { encoding: 'utf8' }): string;
  writeFile(path: string, contents: string): void;
  unlink(path: string): void;
}

interface OpenCascadeModule {
  BRepAlgoAPI_Cut_3: new (base: OcShape, tool: OcShape) => OcMakeShape;
  BRepAlgoAPI_Fuse_3: new (base: OcShape, tool: OcShape) => OcMakeShape;
  BRepCheck_Analyzer: new (shape: OcShape, geomControls: boolean) => OcAnalyzer;
  BRepFilletAPI_MakeChamfer: new (shape: OcShape) => {
    Add_2(distance: number, edge: OcShape): void;
    Build(): void;
    Shape(): OcShape;
    delete?(): void;
  };
  BRepFilletAPI_MakeFillet: new (shape: OcShape, filletShape: unknown) => {
    Add_2(distance: number, edge: OcShape): void;
    Build(): void;
    Shape(): OcShape;
    delete?(): void;
  };
  ChFi3d_FilletShape: {
    ChFi3d_Rational: unknown;
  };
  BRepPrimAPI_MakeCylinder_3: new (axis: unknown, radius: number, height: number) => OcMakeShape;
  BRepPrimAPI_MakeBox_1: new (dx: number, dy: number, dz: number) => OcMakeShape;
  BRepPrimAPI_MakeBox_2: new (point: unknown, dx: number, dy: number, dz: number) => OcMakeShape;
  BRepMesh_IncrementalMesh_2: new (
    shape: OcShape,
    linearDeflection: number,
    isRelative: boolean,
    angularDeflection: number,
    inParallel: boolean,
  ) => OcIncrementalMesh;
  BRep_Tool: {
    Triangulation(face: OcShape, location: unknown): OcTriangulationHandle;
  };
  STEPControl_StepModelType: {
    STEPControl_AsIs: unknown;
    STEPControl_ManifoldSolidBrep: unknown;
  };
  STEPControl_Writer_1: new () => OcStepWriter;
  STEPControl_Reader_1: new () => OcStepReader;
  IFSelect_ReturnStatus: {
    IFSelect_RetDone: unknown;
  };
  Bnd_Box_1: new () => OcBoundingBox;
  BRepBndLib: {
    AddOptimal(shape: OcShape, box: OcBoundingBox, useTriangulation: boolean, useShapeTolerance: boolean): void;
  };
  FS: OcFileSystem;
  TopAbs_ShapeEnum: {
    TopAbs_EDGE: unknown;
    TopAbs_FACE: unknown;
    TopAbs_SHAPE: unknown;
    TopAbs_SOLID: unknown;
  };
  TopAbs_Orientation: {
    TopAbs_REVERSED: unknown;
  };
  TopExp_Explorer_2: new (shape: OcShape, target: unknown, avoid: unknown) => OcExplorer;
  TopLoc_Location_1: new () => unknown;
  TopoDS: {
    Edge_1(shape: OcShape): OcShape;
    Face_1(shape: OcShape): OcShape;
  };
  gp_Ax2_3: new (point: unknown, direction: unknown) => unknown;
  gp_Dir_4: new (x: number, y: number, z: number) => unknown;
  gp_Pnt_3: new (x: number, y: number, z: number) => unknown;
}

interface Box {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

interface FeatureTool {
  operation: DesignFeature['operation'];
  shape: DesignFeature['shape'];
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  diameter: number;
  cornerRadius: number;
}

interface StepConnectorPreset {
  match: RegExp;
  label: string;
  width: number;
  height: number;
  z: number;
}

interface StepNamedPoint {
  name: string;
  x: number;
  y: number;
  z: number;
}

interface KernelStepModel {
  shapes: OcShape[];
}

const stepConnectorPresets: StepConnectorPreset[] = [
  { match: /rj45|ethernet/iu, label: 'Ethernet', width: 16, height: 14, z: 10 },
  { match: /usb[_\s-]?c|type[_\s-]?c|usbc/iu, label: 'USB-C', width: 10, height: 4, z: 7 },
  { match: /micro[_\s-]?usb|microusb/iu, label: 'Micro USB', width: 9, height: 4, z: 6 },
  { match: /mini[_\s-]?usb|miniusb/iu, label: 'Mini USB', width: 9, height: 5, z: 6 },
  { match: /usb[_\s-]?b|usbb/iu, label: 'USB-B', width: 13, height: 12, z: 9 },
  { match: /usb[_\s-]?a|usba/iu, label: 'USB-A', width: 15, height: 8, z: 8 },
  { match: /hdmi/iu, label: 'HDMI', width: 15, height: 5, z: 7 },
  { match: /sma|rp[_\s-]?sma/iu, label: 'SMA', width: 7, height: 7, z: 9 },
  { match: /barrel|dc[_\s-]?jack|power[_\s-]?jack/iu, label: 'Barrel jack', width: 11, height: 11, z: 9 },
  { match: /button|switch/iu, label: 'Button/switch', width: 8, height: 5, z: 7 },
];

let openCascadePromise: Promise<OpenCascadeModule> | undefined;
let stepFileCounter = 0;
let stepImportCounter = 0;

export interface StepImportResult {
  pcb: PcbSpecification;
  warnings: string[];
}

export async function exportTwoPieceScrewCaseStep(project: EnclosureProject): Promise<string> {
  const oc = await loadOpenCascade();
  const model = buildTwoPieceScrewCaseStepModel(oc, project);
  const solids = validatedSolids(oc, model, 'STEP export');

  const writer = new oc.STEPControl_Writer_1();
  for (const solid of solids) {
    writer.Transfer(solid, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
  }

  stepFileCounter = (stepFileCounter + 1) % 1_000_000;
  const fileName = `/model${stepFileCounter}.step`;
  removeVirtualFileIfPresent(oc, fileName);
  const beforeWrite = new Set(oc.FS.readdir('/'));
  const status = writer.Write(fileName);
  if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
    writer.delete?.();
    throw new Error('OpenCascade STEP writer failed to write the model.');
  }

  const writtenPath = findWrittenStepPath(oc, fileName, beforeWrite);
  const contents = oc.FS.readFile(writtenPath, { encoding: 'utf8' });
  oc.FS.unlink(writtenPath);
  writer.delete?.();
  return contents;
}

export async function generateTwoPieceScrewCaseKernelMesh(project: EnclosureProject): Promise<TriangleMesh> {
  const oc = await loadOpenCascade();
  const model = buildTwoPieceScrewCaseStepModel(oc, project);
  const solids = validatedSolids(oc, model, 'mesh export');
  const mesh = meshSolids(oc, solids);
  const validation = validateMesh(mesh, { checkTopology: true });
  if (!validation.ok) {
    throw new Error(
      `OpenCascade mesh export produced invalid topology:\n${validation.issues
        .map((issue) => `- ${issue.message}`)
        .join('\n')}`,
    );
  }
  return mesh;
}

export async function importStepPcbReference(contents: string): Promise<StepImportResult> {
  const oc = await loadOpenCascade();
  stepImportCounter = (stepImportCounter + 1) % 1_000_000;
  const fileName = `/import${stepImportCounter}.step`;
  removeVirtualFileIfPresent(oc, fileName);
  oc.FS.writeFile(fileName, contents);

  const reader = new oc.STEPControl_Reader_1();
  try {
    const status = reader.ReadFile(fileName);
    if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error('OpenCascade STEP reader could not read the file.');
    }
    const transferredRoots = reader.TransferRoots();
    if (transferredRoots < 1) {
      throw new Error('OpenCascade STEP reader found no transferable shape roots.');
    }

    const shape = reader.OneShape();
    const bounds = new oc.Bnd_Box_1();
    oc.BRepBndLib.AddOptimal(shape, bounds, true, false);
    if (bounds.IsVoid()) {
      bounds.delete?.();
      throw new Error('OpenCascade STEP reader produced empty bounds.');
    }
    const result = pcbFromBounds({
      x: bounds.GetXmax() - bounds.GetXmin(),
      y: bounds.GetYmax() - bounds.GetYmin(),
      z: bounds.GetZmax() - bounds.GetZmin(),
    });
    bounds.delete?.();
    return result;
  } catch (error) {
    return pcbFromStepTextBounds(contents, error);
  } finally {
    reader.delete?.();
    try {
      oc.FS.unlink(fileName);
    } catch {
      // The in-memory file may not exist if OpenCascade failed before reading it.
    }
  }
}

function pcbFromStepTextBounds(contents: string, readerError: unknown): StepImportResult {
  const points = [...contents.matchAll(
    /CARTESIAN_POINT\s*\(\s*[^,]*,\s*\(\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\)\s*\)/giu,
  )]
    .map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      z: Number(match[3]),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));

  if (points.length === 0) {
    throw readerError instanceof Error ? readerError : new Error(String(readerError));
  }

  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y),
      minZ: Math.min(current.minZ, point.z),
      maxZ: Math.max(current.maxZ, point.z),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
  const result = pcbFromBounds({
    x: bounds.maxX - bounds.minX,
    y: bounds.maxY - bounds.minY,
    z: bounds.maxZ - bounds.minZ,
  });
  const mountingHoles = detectStepTextMountingHoles(contents, bounds);
  const connectorCutouts = detectStepTextConnectorCutouts(contents, bounds);
  return {
    pcb: {
      ...result.pcb,
      mountingHoles,
      connectorCutouts,
    },
    warnings: [
      ...result.warnings,
      'OpenCascade could not transfer STEP topology; dimensions were recovered from STEP point coordinates.',
      ...(mountingHoles.length > 0
        ? [`Detected ${mountingHoles.length} high-confidence circular through-hole(s) from STEP curve topology.`]
        : []),
      ...(connectorCutouts.length > 0
        ? [`Detected ${connectorCutouts.length} named connector cutout candidate(s) from STEP placement labels.`]
        : []),
    ],
  };
}

function detectStepTextMountingHoles(
  contents: string,
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
): PcbSpecification['mountingHoles'] {
  const points = new Map<string, { x: number; y: number; z: number }>();
  for (const match of contents.matchAll(
    /#(\d+)\s*=\s*CARTESIAN_POINT\s*\(\s*[^,]*,\s*\(\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\)\s*\)/giu,
  )) {
    points.set(match[1] ?? '', {
      x: Number(match[2]),
      y: Number(match[3]),
      z: Number(match[4]),
    });
  }

  const axisOrigins = new Map<string, string>();
  for (const match of contents.matchAll(/#(\d+)\s*=\s*AXIS2_PLACEMENT_3D\s*\(\s*[^,]*,\s*#(\d+)/giu)) {
    axisOrigins.set(match[1] ?? '', match[2] ?? '');
  }

  const candidates: { x: number; y: number; z: number; radius: number }[] = [];
  for (const match of contents.matchAll(
    /#(\d+)\s*=\s*CIRCLE\s*\(\s*[^,]*,\s*#(\d+)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\)/giu,
  )) {
    const originId = axisOrigins.get(match[2] ?? '');
    const center = originId ? points.get(originId) : undefined;
    const radius = Number(match[3]);
    if (!center || !Number.isFinite(radius) || radius < 1 || radius > 3.5) {
      continue;
    }
    candidates.push({ ...center, radius });
  }

  const byCenter = new Map<string, { x: number; y: number; z: number; radius: number }[]>();
  for (const candidate of candidates) {
    if (
      candidate.x <= bounds.minX ||
      candidate.x >= bounds.maxX ||
      candidate.y <= bounds.minY ||
      candidate.y >= bounds.maxY
    ) {
      continue;
    }
    const key = `${round(candidate.x)}:${round(candidate.y)}:${round(candidate.radius)}`;
    byCenter.set(key, [...(byCenter.get(key) ?? []), candidate]);
  }

  const holes: PcbSpecification['mountingHoles'] = [];
  for (const group of byCenter.values()) {
    const hasBottom = group.some((candidate) => nearlyEqual(candidate.z, bounds.minZ));
    const hasTop = group.some((candidate) => nearlyEqual(candidate.z, bounds.maxZ));
    const first = group[0];
    if (!first || !hasBottom || !hasTop) {
      continue;
    }
    holes.push({
      id: `step-hole-${holes.length + 1}`,
      x: round(first.x - bounds.minX),
      y: round(first.y - bounds.minY),
      diameter: round(first.radius * 2),
    });
  }

  return holes;
}

function detectStepTextConnectorCutouts(
  contents: string,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): ConnectorCutout[] {
  const boardWidth = bounds.maxX - bounds.minX;
  const boardHeight = bounds.maxY - bounds.minY;
  const cutouts: ConnectorCutout[] = [];
  for (const point of stepNamedPoints(contents)) {
    const preset = stepConnectorPresets.find((candidate) => candidate.match.test(point.name));
    if (!preset) {
      continue;
    }
    const relative = { x: point.x - bounds.minX, y: point.y - bounds.minY };
    const side = connectorSide(relative, boardWidth, boardHeight);
    if (!side) {
      continue;
    }
    const offset = side === 'front' || side === 'back' ? relative.x : relative.y;
    if (cutouts.some((cutout) => cutout.side === side && Math.abs(cutout.offset - offset) < 1.5 && cutout.label === preset.label)) {
      continue;
    }
    cutouts.push({
      id: `step-cutout-${slugify(preset.label)}-${cutouts.length + 1}`,
      label: preset.label,
      side,
      offset: round(offset),
      z: preset.z,
      width: preset.width,
      height: preset.height,
    });
  }
  return cutouts;
}

function stepNamedPoints(contents: string): StepNamedPoint[] {
  const points = new Map<string, StepNamedPoint>();
  for (const match of contents.matchAll(
    /#(\d+)\s*=\s*CARTESIAN_POINT\s*\(\s*'([^']*)'\s*,\s*\(\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\)\s*\)/giu,
  )) {
    points.set(match[1] ?? '', {
      name: match[2] ?? '',
      x: Number(match[3]),
      y: Number(match[4]),
      z: Number(match[5]),
    });
  }

  const namedPoints = [...points.values()].filter((point) => point.name.trim().length > 0);
  for (const match of contents.matchAll(/#(\d+)\s*=\s*AXIS2_PLACEMENT_3D\s*\(\s*'([^']*)'\s*,\s*#(\d+)/giu)) {
    const point = points.get(match[3] ?? '');
    const name = match[2] ?? '';
    if (point && name.trim().length > 0) {
      namedPoints.push({ ...point, name });
    }
  }
  return namedPoints.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z),
  );
}

function connectorSide(point: { x: number; y: number }, boardWidth: number, boardHeight: number): CutoutSide | undefined {
  const edgeThreshold = Math.max(3, Math.min(boardWidth, boardHeight) * 0.08);
  const distances: { side: CutoutSide; distance: number }[] = [
    { side: 'front', distance: point.y },
    { side: 'back', distance: boardHeight - point.y },
    { side: 'left', distance: point.x },
    { side: 'right', distance: boardWidth - point.x },
  ];
  const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= edgeThreshold ? nearest.side : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'connector';
}

function pcbFromBounds(extents: { x: number; y: number; z: number }): StepImportResult {
  return inferPcbFromMechanicalReference({
    source: 'STEP',
    extents: [
      { axis: 'x', size: extents.x },
      { axis: 'y', size: extents.y },
      { axis: 'z', size: extents.z },
    ],
  });
}

async function loadOpenCascade(): Promise<OpenCascadeModule> {
  openCascadePromise ??= initOpenCascade();
  return openCascadePromise;
}

async function initOpenCascade(): Promise<OpenCascadeModule> {
  const require = createRequire(import.meta.url);
  const modulePath = require.resolve('opencascade.js/dist/opencascade.wasm.js');
  const wasmPath = resolve(dirname(modulePath), 'opencascade.wasm.wasm');
  const previousRequire = globalThis.require;
  const previousFileName = globalThis.__filename;
  const previousDirName = globalThis.__dirname;

  globalThis.require = require;
  globalThis.__filename = modulePath;
  globalThis.__dirname = dirname(modulePath);
  try {
    const { default: OpenCascadeFactory } = await import('opencascade.js/dist/opencascade.wasm.js');
    return (await new OpenCascadeFactory({
      wasmBinary: readFileSync(wasmPath),
    })) as OpenCascadeModule;
  } finally {
    restoreGlobal('__filename', previousFileName);
    restoreGlobal('__dirname', previousDirName);
    restoreGlobal('require', previousRequire);
  }
}

function buildTwoPieceScrewCaseStepModel(
  oc: OpenCascadeModule,
  project: EnclosureProject,
): KernelStepModel {
  const { pcb, enclosure } = project;
  const material = getMaterialProfile(enclosure.material);
  const fastenerProfile = fastenerProfileById(enclosure.fastenerProfileId);
  if (!fastenerProfile) {
    throw new Error(`Unknown fastener profile: ${enclosure.fastenerProfileId}`);
  }
  const internalWidth = pcb.width + enclosure.boardClearance * 2;
  const internalHeight = pcb.height + enclosure.boardClearance * 2;
  const outerWidth = internalWidth + enclosure.wallThickness * 2;
  const outerHeight = internalHeight + enclosure.wallThickness * 2;
  const baseOuterHeight =
    enclosure.floorThickness + enclosure.standoffHeight + pcb.thickness + enclosure.baseInternalHeight;
  const partSpacing = 12;

  let base = box(oc, {
    x: 0,
    y: 0,
    z: 0,
    width: outerWidth,
    depth: outerHeight,
    height: baseOuterHeight,
  });
  base = filletOuterBlank(oc, base, outerFilletDistance(enclosure), 'base');
  base = cut(
    oc,
    base,
    box(oc, {
      x: enclosure.wallThickness,
      y: enclosure.wallThickness,
      z: enclosure.floorThickness,
      width: internalWidth,
      depth: internalHeight,
      height: baseOuterHeight - enclosure.floorThickness + 1,
    }),
  );

  for (const cutout of pcb.connectorCutouts) {
    base = cut(oc, base, box(oc, connectorCutoutTool(cutout, enclosure.wallThickness, outerWidth, outerHeight)));
  }
  base = chamfer(oc, base, enclosure.chamfer, 'base');
  const basePcbOrigin = {
    x: enclosure.wallThickness + enclosure.boardClearance,
    y: enclosure.wallThickness + enclosure.boardClearance,
  };
  for (const hole of pcb.mountingHoles) {
    base = fuse(
      oc,
      base,
      tube(
        oc,
        basePcbOrigin.x + hole.x,
        basePcbOrigin.y + hole.y,
        enclosure.floorThickness,
        enclosure.standoffDiameter / 2,
        (enclosure.standoffHoleDiameter + material.holeCompensation) / 2,
        enclosure.standoffHeight,
      ),
    );
  }

  let lid = box(oc, {
    x: outerWidth + partSpacing,
    y: 0,
    z: 0,
    width: outerWidth,
    depth: outerHeight,
    height: enclosure.lidThickness,
  });
  lid = filletOuterBlank(oc, lid, outerFilletDistance(enclosure), 'lid');
  for (const slot of ventilationSlotTools(
    enclosure.ventilationRegions,
    outerWidth + partSpacing,
    enclosure.lidThickness,
  )) {
    lid = cut(oc, lid, box(oc, slot));
  }
  for (const feature of enclosure.designFeatures) {
    const featureTool = designFeatureToolShape(oc, feature, outerWidth + partSpacing, enclosure.lidThickness);
    if (!featureTool) {
      continue;
    }
    if (feature.operation === 'emboss') {
      lid = fuse(oc, lid, featureTool);
    } else {
      lid = cut(oc, lid, featureTool);
    }
  }
  lid = chamfer(oc, lid, enclosure.chamfer, 'lid');
  const lidPcbOrigin = {
    x: outerWidth + partSpacing + enclosure.wallThickness + enclosure.boardClearance,
    y: enclosure.wallThickness + enclosure.boardClearance,
  };
  for (const hole of pcb.mountingHoles) {
    const lidBossOptions: LidBossKernelOptions = {
      x: lidPcbOrigin.x + hole.x,
      y: lidPcbOrigin.y + hole.y,
      z: enclosure.lidThickness,
      outerRadius: enclosure.screwBossDiameter / 2,
      screwRadius: (enclosure.screwHoleDiameter + material.holeCompensation) / 2,
      height: enclosure.standoffHeight,
    };
    if (fastenerProfile.kind === 'heat_set_insert' && fastenerProfile.insertOuterDiameter) {
      lidBossOptions.insertRadius = (fastenerProfile.insertOuterDiameter + material.holeCompensation) / 2;
    }
    if (fastenerProfile.insertDepth) {
      lidBossOptions.insertDepth = fastenerProfile.insertDepth;
    }
    if (fastenerProfile.insertLeadInDiameter) {
      lidBossOptions.leadInRadius = (fastenerProfile.insertLeadInDiameter + material.holeCompensation) / 2;
    }
    if (fastenerProfile.insertLeadInDepth) {
      lidBossOptions.leadInDepth = fastenerProfile.insertLeadInDepth;
    }
    lid = fuse(
      oc,
      lid,
      lidBoss(oc, fastenerProfile, lidBossOptions),
    );
  }

  return { shapes: [base, lid] };
}

function validatedSolids(
  oc: OpenCascadeModule,
  model: KernelStepModel,
  exportName: string,
): OcShape[] {
  if (model.shapes.length === 0) {
    throw new Error(`OpenCascade ${exportName} produced no solids.`);
  }

  const solids = model.shapes.flatMap((shape) => solidsIn(oc, shape));
  if (solids.length === 0) {
    throw new Error(`OpenCascade ${exportName} produced no solids.`);
  }

  for (const [index, solid] of solids.entries()) {
    const analyzer = new oc.BRepCheck_Analyzer(solid, true);
    const isValid = analyzer.IsValid_2();
    analyzer.delete?.();
    if (!isValid) {
      throw new Error(`OpenCascade ${exportName} produced an invalid solid at index ${index}.`);
    }
  }
  return solids;
}

function meshSolids(oc: OpenCascadeModule, solids: OcShape[]): TriangleMesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  const groups: TriangleMesh['groups'] = [];

  for (const [solidIndex, solid] of solids.entries()) {
    const groupStart = indices.length;
    const mesher = new oc.BRepMesh_IncrementalMesh_2(solid, 0.18, false, 0.35, true);
    const isDone = mesher.IsDone();
    mesher.delete?.();
    if (!isDone) {
      throw new Error(`OpenCascade mesh export failed to tessellate solid ${solidIndex}.`);
    }

    appendShapeTriangles(oc, solid, vertices, indices);
    groups.push({
      name: `kernel-solid-${solidIndex + 1}`,
      start: groupStart,
      count: indices.length - groupStart,
    });
  }

  if (vertices.length === 0 || indices.length === 0) {
    throw new Error('OpenCascade mesh export produced an empty mesh.');
  }

  return { vertices, indices, groups, units: 'mm' };
}

function appendShapeTriangles(
  oc: OpenCascadeModule,
  shape: OcShape,
  vertices: number[],
  indices: number[],
): void {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  while (explorer.More()) {
    const faceShape = explorer.Current();
    const face = oc.TopoDS.Face_1(faceShape);
    const location = new oc.TopLoc_Location_1();
    const triangulationHandle = oc.BRep_Tool.Triangulation(face, location);
    if (triangulationHandle.IsNull()) {
      triangulationHandle.delete?.();
      explorer.Next();
      continue;
    }

    appendFaceTriangles(
      triangulationHandle.get(),
      faceShape.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED,
      vertices,
      indices,
    );
    triangulationHandle.delete?.();
    explorer.Next();
  }

  explorer.delete?.();
}

function appendFaceTriangles(
  triangulation: OcTriangulation,
  isReversed: boolean,
  vertices: number[],
  indices: number[],
): void {
  const vertexOffset = vertices.length / 3;
  for (let nodeIndex = 1; nodeIndex <= triangulation.NbNodes(); nodeIndex += 1) {
    const node = triangulation.Node(nodeIndex);
    vertices.push(node.X(), node.Y(), node.Z());
    node.delete?.();
  }

  for (let triangleIndex = 1; triangleIndex <= triangulation.NbTriangles(); triangleIndex += 1) {
    const triangle = triangulation.Triangle(triangleIndex);
    const a = vertexOffset + triangle.Value(1) - 1;
    const b = vertexOffset + triangle.Value(2) - 1;
    const c = vertexOffset + triangle.Value(3) - 1;
    if (isDegenerateTriangle(vertices, a, b, c)) {
      triangle.delete?.();
      continue;
    }
    if (isReversed) {
      indices.push(a, c, b);
    } else {
      indices.push(a, b, c);
    }
    triangle.delete?.();
  }
}

function isDegenerateTriangle(vertices: number[], a: number, b: number, c: number): boolean {
  if (a === b || b === c || c === a) {
    return true;
  }
  return triangleArea(vertexAt(vertices, a), vertexAt(vertices, b), vertexAt(vertices, c)) < 0.000001;
}

function vertexAt(vertices: number[], index: number): { x: number; y: number; z: number } {
  const offset = index * 3;
  return {
    x: vertices[offset] ?? 0,
    y: vertices[offset + 1] ?? 0,
    z: vertices[offset + 2] ?? 0,
  };
}

function connectorCutoutTool(
  cutout: ConnectorCutout,
  wall: number,
  outerWidth: number,
  outerHeight: number,
): Box {
  const z = cutout.z - cutout.height / 2;
  if (cutout.side === 'front') {
    return {
      x: wall + cutout.offset - cutout.width / 2,
      y: -1,
      z,
      width: cutout.width,
      depth: wall + 2,
      height: cutout.height,
    };
  }
  if (cutout.side === 'back') {
    return {
      x: wall + cutout.offset - cutout.width / 2,
      y: outerHeight - wall - 1,
      z,
      width: cutout.width,
      depth: wall + 2,
      height: cutout.height,
    };
  }
  if (cutout.side === 'left') {
    return {
      x: -1,
      y: wall + cutout.offset - cutout.width / 2,
      z,
      width: wall + 2,
      depth: cutout.width,
      height: cutout.height,
    };
  }
  return {
    x: outerWidth - wall - 1,
    y: wall + cutout.offset - cutout.width / 2,
    z,
    width: wall + 2,
    depth: cutout.width,
    height: cutout.height,
  };
}

function ventilationSlotTools(
  regions: VentilationRegion[],
  lidOffsetX: number,
  lidThickness: number,
): Box[] {
  return regions.flatMap((region) => {
    const columnCount = Math.floor((region.width + region.spacing) / (region.slotWidth + region.spacing));
    const rowCount = Math.floor((region.height + region.spacing) / (region.slotHeight + region.spacing));
    if (columnCount < 1 || rowCount < 1) {
      return [];
    }

    const totalWidth = columnCount * region.slotWidth + (columnCount - 1) * region.spacing;
    const totalHeight = rowCount * region.slotHeight + (rowCount - 1) * region.spacing;
    const startX = region.x - totalWidth / 2;
    const startY = region.y - totalHeight / 2;
    const slots: Box[] = [];

    for (let column = 0; column < columnCount; column += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        slots.push({
          x: lidOffsetX + startX + column * (region.slotWidth + region.spacing),
          y: startY + row * (region.slotHeight + region.spacing),
          z: -0.5,
          width: region.slotWidth,
          depth: region.slotHeight,
          height: lidThickness + 1,
        });
      }
    }
    return slots;
  });
}

function designFeatureTools(
  feature: DesignFeature,
  lidOffsetX: number,
  lidThickness: number,
): FeatureTool[] {
  return designFeatureFootprints(feature).map((footprint) => {
    const isThroughCut = feature.operation === 'through_cut';
    const height = isThroughCut ? lidThickness + 1 : Math.max(0.1, feature.depth);
    const z = isThroughCut
      ? -0.5
      : feature.operation === 'recess'
        ? lidThickness - height
        : lidThickness;
    return {
      operation: feature.operation,
      shape: feature.shape,
      x: lidOffsetX + footprint.x,
      y: footprint.y,
      z,
      width: footprint.width,
      depth: footprint.height,
      height,
      diameter: footprint.diameter,
      cornerRadius: footprint.cornerRadius,
    };
  });
}

function designFeatureToolShape(
  oc: OpenCascadeModule,
  feature: DesignFeature,
  lidOffsetX: number,
  lidThickness: number,
): OcShape | undefined {
  const tools = designFeatureTools(feature, lidOffsetX, lidThickness);
  const first = tools[0];
  if (!first) {
    return undefined;
  }

  let shape = featureShape(oc, first);
  for (const tool of tools.slice(1)) {
    shape = fuse(oc, shape, featureShape(oc, tool));
  }
  return shape;
}

function featureShape(oc: OpenCascadeModule, tool: FeatureTool): OcShape {
  if (tool.shape === 'circle') {
    return cylinder(oc, tool.x, tool.y, tool.z, tool.diameter / 2, tool.height);
  }
  if (tool.shape === 'rounded_rectangle') {
    return roundedRectanglePrism(oc, tool);
  }
  return centeredBox(oc, tool.x, tool.y, tool.z, tool.width, tool.depth, tool.height);
}

function roundedRectanglePrism(oc: OpenCascadeModule, tool: FeatureTool): OcShape {
  const radius = Math.max(0, Math.min(tool.cornerRadius, tool.width / 2, tool.depth / 2));
  if (radius <= 0) {
    return centeredBox(oc, tool.x, tool.y, tool.z, tool.width, tool.depth, tool.height);
  }

  let shape = centeredBox(
    oc,
    tool.x,
    tool.y,
    tool.z,
    Math.max(0.01, tool.width - radius * 2),
    tool.depth,
    tool.height,
  );
  shape = fuse(oc, shape, centeredBox(oc, tool.x, tool.y, tool.z, tool.width, Math.max(0.01, tool.depth - radius * 2), tool.height));

  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      shape = fuse(
        oc,
        shape,
        cylinder(
          oc,
          tool.x + xSign * (tool.width / 2 - radius),
          tool.y + ySign * (tool.depth / 2 - radius),
          tool.z,
          radius,
          tool.height,
        ),
      );
    }
  }

  return shape;
}

function centeredBox(
  oc: OpenCascadeModule,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
): OcShape {
  return box(oc, {
    x: x - width / 2,
    y: y - depth / 2,
    z,
    width,
    depth,
    height,
  });
}

function box(oc: OpenCascadeModule, dimensions: Box): OcShape {
  return new oc.BRepPrimAPI_MakeBox_2(
    new oc.gp_Pnt_3(dimensions.x, dimensions.y, dimensions.z),
    dimensions.width,
    dimensions.depth,
    dimensions.height,
  ).Shape();
}

function cut(oc: OpenCascadeModule, base: OcShape, tool: OcShape): OcShape {
  return new oc.BRepAlgoAPI_Cut_3(base, tool).Shape();
}

function fuse(oc: OpenCascadeModule, base: OcShape, tool: OcShape): OcShape {
  return new oc.BRepAlgoAPI_Fuse_3(base, tool).Shape();
}

function chamfer(
  oc: OpenCascadeModule,
  shape: OcShape,
  distance: number,
  partName: string,
): OcShape {
  if (distance <= 0) {
    return shape;
  }

  const chamferBuilder = new oc.BRepFilletAPI_MakeChamfer(shape);
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  const edges: OcShape[] = [];
  while (explorer.More()) {
    const edge = oc.TopoDS.Edge_1(explorer.Current());
    if (!edges.some((existingEdge) => existingEdge.IsSame(edge))) {
      edges.push(edge);
    }
    explorer.Next();
  }
  explorer.delete?.();

  if (edges.length === 0) {
    chamferBuilder.delete?.();
    throw new Error(`OpenCascade could not find edges to chamfer on the ${partName}.`);
  }

  try {
    for (const edge of edges) {
      chamferBuilder.Add_2(distance, edge);
    }
    chamferBuilder.Build();
    const result = chamferBuilder.Shape();
    const analyzer = new oc.BRepCheck_Analyzer(result, true);
    const isValid = analyzer.IsValid_2();
    analyzer.delete?.();
    if (!isValid) {
      throw new Error('resulting solid failed B-rep validation');
    }
    return result;
  } catch (error) {
    throw new Error(
      `OpenCascade could not apply a ${distance} mm chamfer to the ${partName}. Reduce the chamfer or increase nearby feature spacing. Cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    chamferBuilder.delete?.();
  }
}

function filletOuterBlank(
  oc: OpenCascadeModule,
  shape: OcShape,
  distance: number,
  partName: string,
): OcShape {
  if (distance <= 0) {
    return shape;
  }

  const filletBuilder = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  const edges: OcShape[] = [];
  while (explorer.More()) {
    const edge = oc.TopoDS.Edge_1(explorer.Current());
    if (!edges.some((existingEdge) => existingEdge.IsSame(edge))) {
      edges.push(edge);
    }
    explorer.Next();
  }
  explorer.delete?.();

  if (edges.length === 0) {
    filletBuilder.delete?.();
    throw new Error(`OpenCascade could not find outer blank edges to fillet on the ${partName}.`);
  }

  try {
    for (const edge of edges) {
      filletBuilder.Add_2(distance, edge);
    }
    filletBuilder.Build();
    const result = filletBuilder.Shape();
    const analyzer = new oc.BRepCheck_Analyzer(result, true);
    const isValid = analyzer.IsValid_2();
    analyzer.delete?.();
    if (!isValid) {
      throw new Error('resulting solid failed B-rep validation');
    }
    return result;
  } catch (error) {
    throw new Error(
      `OpenCascade could not apply a ${distance} mm selective outer fillet to the ${partName}. Reduce case radius or use chamfer instead. Cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    filletBuilder.delete?.();
  }
}

function outerFilletDistance(enclosure: TwoPieceScrewCaseParameters): number {
  if (enclosure.chamfer > 0 || enclosure.cornerRadius <= 0) {
    return 0;
  }
  return Math.min(enclosure.cornerRadius * 0.08, enclosure.wallThickness * 0.2, enclosure.floorThickness * 0.2, 0.35);
}

function tube(
  oc: OpenCascadeModule,
  x: number,
  y: number,
  z: number,
  outerRadius: number,
  innerRadius: number,
  height: number,
): OcShape {
  return cut(
    oc,
    cylinder(oc, x, y, z, outerRadius, height),
    cylinder(oc, x, y, z - 0.5, innerRadius, height + 1),
  );
}

interface LidBossKernelOptions {
  x: number;
  y: number;
  z: number;
  outerRadius: number;
  screwRadius: number;
  insertRadius?: number;
  insertDepth?: number;
  leadInRadius?: number;
  leadInDepth?: number;
  height: number;
}

function lidBoss(
  oc: OpenCascadeModule,
  fastenerProfile: FastenerProfile,
  options: LidBossKernelOptions,
): OcShape {
  const boss = tube(
    oc,
    options.x,
    options.y,
    options.z,
    options.outerRadius,
    options.screwRadius,
    options.height,
  );

  if (
    fastenerProfile.kind !== 'heat_set_insert' ||
    options.insertRadius === undefined ||
    options.insertDepth === undefined ||
    options.insertRadius <= options.screwRadius
  ) {
    return boss;
  }

  const seatDepth = Math.min(options.insertDepth, options.height);
  let shapedBoss = cut(
    oc,
    boss,
    cylinder(
      oc,
      options.x,
      options.y,
      options.z + options.height - seatDepth,
      options.insertRadius,
      seatDepth + 0.5,
    ),
  );
  if (
    options.leadInRadius !== undefined &&
    options.leadInDepth !== undefined &&
    options.leadInRadius > options.insertRadius
  ) {
    const leadInDepth = Math.min(options.leadInDepth, options.height);
    shapedBoss = cut(
      oc,
      shapedBoss,
      cylinder(
        oc,
        options.x,
        options.y,
        options.z + options.height - leadInDepth,
        options.leadInRadius,
        leadInDepth + 0.5,
      ),
    );
  }
  return shapedBoss;
}

function cylinder(
  oc: OpenCascadeModule,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
): OcShape {
  return new oc.BRepPrimAPI_MakeCylinder_3(
    new oc.gp_Ax2_3(new oc.gp_Pnt_3(x, y, z), new oc.gp_Dir_4(0, 0, 1)),
    radius,
    height,
  ).Shape();
}

function solidsIn(oc: OpenCascadeModule, shape: OcShape): OcShape[] {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_SOLID,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  const solids: OcShape[] = [];
  while (explorer.More()) {
    solids.push(explorer.Current());
    explorer.Next();
  }
  explorer.delete?.();
  return solids.length > 0 ? solids : [shape];
}

function findWrittenStepPath(
  oc: OpenCascadeModule,
  requestedFileName: string,
  beforeWrite: Set<string>,
): string {
  const requestedEntry = requestedFileName.replace(/^\//u, '');
  if (oc.FS.readdir('/').includes(requestedEntry)) {
    return requestedFileName;
  }
  const createdEntries = oc.FS
    .readdir('/')
    .filter((entry) => entry !== '.' && entry !== '..' && !beforeWrite.has(entry));
  if (createdEntries.length === 1 && createdEntries[0]) {
    return `/${createdEntries[0]}`;
  }
  throw new Error('OpenCascade STEP writer did not produce a readable virtual file.');
}

function removeVirtualFileIfPresent(oc: OpenCascadeModule, fileName: string): void {
  const entry = fileName.replace(/^\//u, '');
  if (!oc.FS.readdir('/').includes(entry)) {
    return;
  }
  try {
    oc.FS.unlink(fileName);
  } catch {
    oc.FS.unlink(entry);
  }
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function restoreGlobal(name: '__dirname' | '__filename' | 'require', value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Reflect.set(globalThis, name, value);
}

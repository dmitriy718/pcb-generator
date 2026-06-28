import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import type { ConnectorCutout, EnclosureProject, VentilationRegion } from '../../domain';

interface OcShape {
  ShapeType(): unknown;
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

interface OcExplorer {
  More(): boolean;
  Current(): OcShape;
  Next(): void;
  delete?(): void;
}

interface OcFileSystem {
  readdir(path: string): string[];
  readFile(path: string, options: { encoding: 'utf8' }): string;
  unlink(path: string): void;
}

interface OpenCascadeModule {
  BRepAlgoAPI_Cut_3: new (base: OcShape, tool: OcShape) => OcMakeShape;
  BRepCheck_Analyzer: new (shape: OcShape, geomControls: boolean) => OcAnalyzer;
  BRepPrimAPI_MakeBox_1: new (dx: number, dy: number, dz: number) => OcMakeShape;
  BRepPrimAPI_MakeBox_2: new (point: unknown, dx: number, dy: number, dz: number) => OcMakeShape;
  STEPControl_StepModelType: {
    STEPControl_AsIs: unknown;
    STEPControl_ManifoldSolidBrep: unknown;
  };
  STEPControl_Writer_1: new () => OcStepWriter;
  IFSelect_ReturnStatus: {
    IFSelect_RetDone: unknown;
  };
  FS: OcFileSystem;
  TopAbs_ShapeEnum: {
    TopAbs_SHAPE: unknown;
    TopAbs_SOLID: unknown;
  };
  TopExp_Explorer_2: new (shape: OcShape, target: unknown, avoid: unknown) => OcExplorer;
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

interface KernelStepModel {
  shapes: OcShape[];
}

let openCascadePromise: Promise<OpenCascadeModule> | undefined;
let stepFileCounter = 0;

export async function exportTwoPieceScrewCaseStep(project: EnclosureProject): Promise<string> {
  const oc = await loadOpenCascade();
  const model = buildTwoPieceScrewCaseStepModel(oc, project);
  if (model.shapes.length === 0) {
    throw new Error('OpenCascade STEP export produced no solids.');
  }

  for (const [index, shape] of model.shapes.entries()) {
    const analyzer = new oc.BRepCheck_Analyzer(shape, true);
    const isValid = analyzer.IsValid_2();
    analyzer.delete?.();
    if (!isValid) {
      throw new Error(`OpenCascade STEP export produced an invalid solid at index ${index}.`);
    }
  }

  const writer = new oc.STEPControl_Writer_1();
  for (const shape of model.shapes) {
    for (const solid of solidsIn(oc, shape)) {
      writer.Transfer(solid, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
    }
  }

  stepFileCounter = (stepFileCounter + 1) % 1_000_000;
  const fileName = `model${stepFileCounter}.step`;
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

  let lid = box(oc, {
    x: outerWidth + partSpacing,
    y: 0,
    z: 0,
    width: outerWidth,
    depth: outerHeight,
    height: enclosure.lidThickness,
  });
  for (const slot of ventilationSlotTools(
    enclosure.ventilationRegions,
    outerWidth + partSpacing,
    enclosure.lidThickness,
  )) {
    lid = cut(oc, lid, box(oc, slot));
  }

  return { shapes: [base, lid] };
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
  if (oc.FS.readdir('/').includes(requestedFileName)) {
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

function restoreGlobal(name: '__dirname' | '__filename' | 'require', value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Reflect.set(globalThis, name, value);
}

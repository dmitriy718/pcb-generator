import type { ConnectorCutout, CutoutSide, MountingHole, PcbSpecification } from '../domain';

type SExpr = string | SExpr[];

export interface KiCadImportResult {
  pcb: PcbSpecification;
  warnings: string[];
}

interface Point {
  x: number;
  y: number;
}

interface FootprintContext {
  at: Point;
  rotationDegrees: number;
}

interface BoardOrigin {
  x: number;
  y: number;
}

interface ConnectorPreset {
  match: RegExp;
  label: string;
  width: number;
  height: number;
  z: number;
}

const connectorPresets: ConnectorPreset[] = [
  { match: /rj45|ethernet/iu, label: 'Ethernet', width: 16, height: 14, z: 10 },
  { match: /usb[_-]?c|type[_-]?c|usbc/iu, label: 'USB-C', width: 10, height: 4, z: 7 },
  { match: /micro[_-]?usb|microusb/iu, label: 'Micro USB', width: 9, height: 4, z: 6 },
  { match: /mini[_-]?usb|miniusb/iu, label: 'Mini USB', width: 9, height: 5, z: 6 },
  { match: /usb[_-]?b|usbb/iu, label: 'USB-B', width: 13, height: 12, z: 9 },
  { match: /usb[_-]?a|usba/iu, label: 'USB-A', width: 15, height: 8, z: 8 },
  { match: /hdmi/iu, label: 'HDMI', width: 15, height: 5, z: 7 },
  { match: /sma|rp[_-]?sma/iu, label: 'SMA', width: 7, height: 7, z: 9 },
  { match: /barrel|dc[_-]?jack|power[_-]?jack/iu, label: 'Barrel jack', width: 11, height: 11, z: 9 },
  { match: /button|switch/iu, label: 'Button/switch', width: 8, height: 5, z: 7 },
];

const heightHints: { match: RegExp; height: number }[] = [
  { match: /rj45|ethernet/iu, height: 14 },
  { match: /usb[_-]?b|usbb/iu, height: 12 },
  { match: /usb[_-]?a|usba/iu, height: 8 },
  { match: /usb[_-]?c|type[_-]?c|usbc/iu, height: 4 },
  { match: /micro[_-]?usb|microusb/iu, height: 4 },
  { match: /mini[_-]?usb|miniusb/iu, height: 5 },
  { match: /hdmi/iu, height: 5 },
  { match: /sma|rp[_-]?sma/iu, height: 10 },
  { match: /barrel|dc[_-]?jack|power[_-]?jack/iu, height: 11 },
  { match: /pin[_-]?header|header|gpio/iu, height: 8.5 },
  { match: /button|switch/iu, height: 5 },
  { match: /led/iu, height: 2 },
];

export function importKiCadPcb(contents: string): KiCadImportResult {
  const root = parseSExpression(contents);
  const warnings: string[] = [];
  const outlinePoints = collectEdgeCutPoints(root);

  if (outlinePoints.length === 0) {
    throw new Error('No Edge.Cuts board outline geometry was found in the KiCad PCB file.');
  }

  const bounds = boundsFor(outlinePoints);
  const width = roundMillimeters(bounds.maxX - bounds.minX);
  const height = roundMillimeters(bounds.maxY - bounds.minY);
  if (width <= 0 || height <= 0) {
    throw new Error('Edge.Cuts outline did not produce a positive board width and height.');
  }

  const thickness = findBoardThickness(root) ?? 1.6;
  if (findBoardThickness(root) === undefined) {
    warnings.push('Board thickness was not declared; defaulted to 1.6 mm.');
  }

  const origin = { x: bounds.minX, y: bounds.minY };
  const mountingHoles = collectMountingHoles(root, origin);
  if (mountingHoles.length === 0) {
    warnings.push('No drilled mounting holes were detected.');
  }
  const componentHeight = collectComponentHeight(root);
  if (componentHeight > 0) {
    warnings.push(`Detected maximum component height hint: ${roundMillimeters(componentHeight)} mm.`);
  }
  const connectorCutouts = collectConnectorCutouts(root, origin, width, height);
  if (connectorCutouts.length > 0) {
    warnings.push(`Detected ${connectorCutouts.length} connector cutout candidate(s). Verify placement and clearance.`);
  }

  return {
    pcb: {
      width,
      height,
      thickness: roundMillimeters(thickness),
      componentHeight: roundMillimeters(componentHeight),
      cornerRadius: 0,
      mountingHoles,
      connectorCutouts,
    },
    warnings,
  };
}

export function parseSExpression(contents: string): SExpr {
  const tokens = tokenize(contents);
  let cursor = 0;

  function parseExpression(): SExpr {
    const token = tokens[cursor];
    cursor += 1;

    if (token === undefined) {
      throw new Error('Unexpected end of KiCad PCB file.');
    }

    if (token === '(') {
      const list: SExpr[] = [];
      while (tokens[cursor] !== ')') {
        if (cursor >= tokens.length) {
          throw new Error('Unclosed S-expression list in KiCad PCB file.');
        }
        list.push(parseExpression());
      }
      cursor += 1;
      return list;
    }

    if (token === ')') {
      throw new Error('Unexpected closing parenthesis in KiCad PCB file.');
    }

    return token;
  }

  const expression = parseExpression();
  if (cursor !== tokens.length) {
    throw new Error('KiCad PCB file contains trailing tokens after the root expression.');
  }
  return expression;
}

function tokenize(contents: string): string[] {
  const tokens: string[] = [];
  let cursor = 0;

  while (cursor < contents.length) {
    const current = contents[cursor];
    if (current === undefined) {
      break;
    }

    if (/\s/.test(current)) {
      cursor += 1;
      continue;
    }

    if (current === ';') {
      while (cursor < contents.length && contents[cursor] !== '\n') {
        cursor += 1;
      }
      continue;
    }

    if (current === '(' || current === ')') {
      tokens.push(current);
      cursor += 1;
      continue;
    }

    if (current === '"') {
      const result = readQuotedString(contents, cursor + 1);
      tokens.push(result.value);
      cursor = result.nextCursor;
      continue;
    }

    let end = cursor;
    while (end < contents.length && !/\s|\(|\)|;/.test(contents[end] ?? '')) {
      end += 1;
    }
    tokens.push(contents.slice(cursor, end));
    cursor = end;
  }

  return tokens;
}

function readQuotedString(contents: string, cursor: number): { value: string; nextCursor: number } {
  let value = '';
  let currentCursor = cursor;

  while (currentCursor < contents.length) {
    const current = contents[currentCursor];
    if (current === undefined) {
      break;
    }

    if (current === '\\') {
      const escaped = contents[currentCursor + 1];
      if (escaped === undefined) {
        throw new Error('Unterminated escape sequence in quoted KiCad string.');
      }
      value += escaped;
      currentCursor += 2;
      continue;
    }

    if (current === '"') {
      return { value, nextCursor: currentCursor + 1 };
    }

    value += current;
    currentCursor += 1;
  }

  throw new Error('Unterminated quoted string in KiCad PCB file.');
}

function collectEdgeCutPoints(root: SExpr): Point[] {
  const points: Point[] = [];
  walk(root, (node) => {
    if (!isList(node) || !hasLayer(node, 'Edge.Cuts')) {
      return;
    }

    const head = listHead(node);
    if (head === 'gr_line' || head === 'fp_line') {
      pushPoint(points, childPoint(node, 'start'));
      pushPoint(points, childPoint(node, 'end'));
      return;
    }

    if (head === 'gr_rect' || head === 'fp_rect') {
      const start = childPoint(node, 'start');
      const end = childPoint(node, 'end');
      if (start && end) {
        points.push(start, end, { x: start.x, y: end.y }, { x: end.x, y: start.y });
      }
      return;
    }

    if (head === 'gr_circle' || head === 'fp_circle') {
      const center = childPoint(node, 'center');
      const end = childPoint(node, 'end');
      if (center && end) {
        const radius = Math.hypot(end.x - center.x, end.y - center.y);
        points.push(
          { x: center.x - radius, y: center.y - radius },
          { x: center.x + radius, y: center.y + radius },
        );
      }
      return;
    }

    if (head === 'gr_arc' || head === 'fp_arc') {
      pushPoint(points, childPoint(node, 'start'));
      pushPoint(points, childPoint(node, 'mid'));
      pushPoint(points, childPoint(node, 'end'));
    }
  });

  return points;
}

function findBoardThickness(root: SExpr): number | undefined {
  let thickness: number | undefined;
  walk(root, (node) => {
    if (thickness !== undefined || !isList(node)) {
      return;
    }
    if (listHead(node) === 'thickness') {
      thickness = numberAt(node, 1);
    }
  });
  return thickness;
}

function collectMountingHoles(root: SExpr, origin: BoardOrigin): MountingHole[] {
  const holes: MountingHole[] = [];
  walk(root, (node) => {
    if (!isList(node) || (listHead(node) !== 'footprint' && listHead(node) !== 'module')) {
      return;
    }

    const context = footprintContext(node);
    for (const child of node) {
      if (!isList(child) || listHead(child) !== 'pad' || !isMountingPad(child)) {
        continue;
      }

      const drill = drillDiameter(child);
      const padAt = childPoint(child, 'at') ?? { x: 0, y: 0 };
      if (drill === undefined || drill <= 0) {
        continue;
      }

      const absolute = rotateAndTranslate(padAt, context);
      holes.push({
        id: `mh-${holes.length + 1}`,
        x: roundMillimeters(absolute.x - origin.x),
        y: roundMillimeters(absolute.y - origin.y),
        diameter: roundMillimeters(drill),
      });
    }
  });
  return holes;
}

function collectComponentHeight(root: SExpr): number {
  let height = 0;
  walk(root, (node) => {
    if (!isList(node) || (listHead(node) !== 'footprint' && listHead(node) !== 'module')) {
      return;
    }
    const tokens = footprintSearchText(node);
    height = Math.max(height, propertyHeightHint(node) ?? 0, libraryHeightHint(tokens));
  });
  return roundMillimeters(height);
}

function collectConnectorCutouts(
  root: SExpr,
  origin: BoardOrigin,
  boardWidth: number,
  boardHeight: number,
): ConnectorCutout[] {
  const cutouts: ConnectorCutout[] = [];
  walk(root, (node) => {
    if (!isList(node) || (listHead(node) !== 'footprint' && listHead(node) !== 'module')) {
      return;
    }
    const context = footprintContext(node);
    const relative = { x: context.at.x - origin.x, y: context.at.y - origin.y };
    const preset = connectorPresetFor(footprintSearchText(node));
    const side = connectorSide(relative, boardWidth, boardHeight);
    if (!preset || !side) {
      return;
    }
    const offset = side === 'front' || side === 'back' ? relative.x : relative.y;
    if (cutouts.some((cutout) => cutout.side === side && Math.abs(cutout.offset - offset) < 1.5 && cutout.label === preset.label)) {
      return;
    }
    cutouts.push({
      id: `cutout-${slugify(preset.label)}-${cutouts.length + 1}`,
      label: preset.label,
      side,
      offset: roundMillimeters(offset),
      z: preset.z,
      width: preset.width,
      height: preset.height,
    });
  });
  return cutouts;
}

function connectorPresetFor(searchText: string): ConnectorPreset | undefined {
  return connectorPresets.find((preset) => preset.match.test(searchText));
}

function connectorSide(point: Point, boardWidth: number, boardHeight: number): CutoutSide | undefined {
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

function footprintSearchText(node: SExpr[]): string {
  const values: string[] = [];
  for (const item of node) {
    if (typeof item === 'string') {
      values.push(item);
    } else if (isList(item) && (item[0] === 'property' || item[0] === 'model' || item[0] === 'fp_text')) {
      values.push(...item.filter((child): child is string => typeof child === 'string'));
    }
  }
  return values.join(' ');
}

function propertyHeightHint(node: SExpr[]): number | undefined {
  for (const child of node) {
    if (!isList(child) || child[0] !== 'property') {
      continue;
    }
    const key = typeof child[1] === 'string' ? child[1].toLowerCase() : '';
    const value = typeof child[2] === 'string' ? child[2] : '';
    if (/height|component[_ -]?height|z[_ -]?height/iu.test(key)) {
      const parsed = parseMillimeterValue(value);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
}

function libraryHeightHint(searchText: string): number {
  return heightHints.find((hint) => hint.match.test(searchText))?.height ?? 0;
}

function parseMillimeterValue(value: string): number | undefined {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*(mm|millimeter|millimeters)?/iu.exec(value);
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'connector';
}

function footprintContext(node: SExpr[]): FootprintContext {
  const at = childList(node, 'at');
  return {
    at: { x: numberAt(at, 1) ?? 0, y: numberAt(at, 2) ?? 0 },
    rotationDegrees: numberAt(at, 3) ?? 0,
  };
}

function isMountingPad(node: SExpr[]): boolean {
  const tokens = node.filter((item): item is string => typeof item === 'string');
  if (tokens.includes('np_thru_hole')) {
    return true;
  }
  return tokens.includes('thru_hole') && childList(node, 'drill') !== undefined;
}

function drillDiameter(node: SExpr[]): number | undefined {
  const drill = childList(node, 'drill');
  if (!drill) {
    return undefined;
  }
  if (drill[1] === 'oval') {
    const width = numberAt(drill, 2);
    const height = numberAt(drill, 3);
    if (width !== undefined && height !== undefined) {
      return Math.min(width, height);
    }
  }
  return numberAt(drill, 1);
}

function hasLayer(node: SExpr[], layerName: string): boolean {
  return childList(node, 'layer')?.some((item) => item === layerName) ?? false;
}

function childPoint(node: SExpr[] | undefined, name: string): Point | undefined {
  const child = childList(node, name);
  const x = numberAt(child, 1);
  const y = numberAt(child, 2);
  return x === undefined || y === undefined ? undefined : { x, y };
}

function childList(node: SExpr[] | undefined, name: string): SExpr[] | undefined {
  return node?.find((child): child is SExpr[] => isList(child) && child[0] === name);
}

function numberAt(node: SExpr[] | undefined, index: number): number | undefined {
  const value = node?.[index];
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rotateAndTranslate(point: Point, context: FootprintContext): Point {
  const radians = (context.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: context.at.x + point.x * cos - point.y * sin,
    y: context.at.y + point.x * sin + point.y * cos,
  };
}

function boundsFor(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
}

function pushPoint(points: Point[], point: Point | undefined): void {
  if (point) {
    points.push(point);
  }
}

function walk(node: SExpr, visit: (node: SExpr) => void): void {
  visit(node);
  if (!isList(node)) {
    return;
  }
  for (const child of node) {
    walk(child, visit);
  }
}

function isList(node: SExpr): node is SExpr[] {
  return Array.isArray(node);
}

function listHead(node: SExpr[]): string | undefined {
  return typeof node[0] === 'string' ? node[0] : undefined;
}

function roundMillimeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

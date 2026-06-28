import type { MeshGroup, TriangleMesh } from '../domain';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export class MeshBuilder {
  private readonly vertices: number[] = [];
  private readonly indices: number[] = [];
  private readonly groups: MeshGroup[] = [];

  addGroup(name: string, build: () => void): void {
    const start = this.indices.length;
    build();
    const count = this.indices.length - start;
    if (count > 0) {
      this.groups.push({ name, start, count });
    }
  }

  addVertex(vertex: Vec3): number {
    const index = this.vertices.length / 3;
    this.vertices.push(vertex.x, vertex.y, vertex.z);
    return index;
  }

  addTriangle(a: Vec3, b: Vec3, c: Vec3): void {
    const ai = this.addVertex(a);
    const bi = this.addVertex(b);
    const ci = this.addVertex(c);
    this.indices.push(ai, bi, ci);
  }

  addQuad(a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
    this.addTriangle(a, b, c);
    this.addTriangle(a, c, d);
  }

  addBox(min: Vec3, max: Vec3): void {
    const p000 = { x: min.x, y: min.y, z: min.z };
    const p100 = { x: max.x, y: min.y, z: min.z };
    const p110 = { x: max.x, y: max.y, z: min.z };
    const p010 = { x: min.x, y: max.y, z: min.z };
    const p001 = { x: min.x, y: min.y, z: max.z };
    const p101 = { x: max.x, y: min.y, z: max.z };
    const p111 = { x: max.x, y: max.y, z: max.z };
    const p011 = { x: min.x, y: max.y, z: max.z };

    this.addQuad(p000, p010, p110, p100);
    this.addQuad(p001, p101, p111, p011);
    this.addQuad(p000, p100, p101, p001);
    this.addQuad(p100, p110, p111, p101);
    this.addQuad(p110, p010, p011, p111);
    this.addQuad(p010, p000, p001, p011);
  }

  addOpenBoxShell(origin: Vec3, size: Vec3, wall: number, floor: number): void {
    const min = origin;
    const max = { x: origin.x + size.x, y: origin.y + size.y, z: origin.z + size.z };
    this.addBox({ x: min.x, y: min.y, z: min.z }, { x: max.x, y: max.y, z: min.z + floor });
    this.addBox({ x: min.x, y: min.y, z: min.z }, { x: min.x + wall, y: max.y, z: max.z });
    this.addBox({ x: max.x - wall, y: min.y, z: min.z }, { x: max.x, y: max.y, z: max.z });
    this.addBox({ x: min.x + wall, y: min.y, z: min.z }, { x: max.x - wall, y: min.y + wall, z: max.z });
    this.addBox({ x: min.x + wall, y: max.y - wall, z: min.z }, { x: max.x - wall, y: max.y, z: max.z });
  }

  addCylinder(center: Vec3, radius: number, height: number, segments: number): void {
    const z0 = center.z;
    const z1 = center.z + height;
    const topCenter = { x: center.x, y: center.y, z: z1 };
    const bottomCenter = { x: center.x, y: center.y, z: z0 };

    for (let i = 0; i < segments; i += 1) {
      const a0 = (Math.PI * 2 * i) / segments;
      const a1 = (Math.PI * 2 * (i + 1)) / segments;
      const p0 = { x: center.x + Math.cos(a0) * radius, y: center.y + Math.sin(a0) * radius, z: z0 };
      const p1 = { x: center.x + Math.cos(a1) * radius, y: center.y + Math.sin(a1) * radius, z: z0 };
      const p2 = { x: p1.x, y: p1.y, z: z1 };
      const p3 = { x: p0.x, y: p0.y, z: z1 };
      this.addQuad(p0, p1, p2, p3);
      this.addTriangle(bottomCenter, p1, p0);
      this.addTriangle(topCenter, p3, p2);
    }
  }

  addTube(center: Vec3, outerRadius: number, innerRadius: number, height: number, segments: number): void {
    const z0 = center.z;
    const z1 = center.z + height;

    for (let i = 0; i < segments; i += 1) {
      const a0 = (Math.PI * 2 * i) / segments;
      const a1 = (Math.PI * 2 * (i + 1)) / segments;
      const outer0Bottom = {
        x: center.x + Math.cos(a0) * outerRadius,
        y: center.y + Math.sin(a0) * outerRadius,
        z: z0,
      };
      const outer1Bottom = {
        x: center.x + Math.cos(a1) * outerRadius,
        y: center.y + Math.sin(a1) * outerRadius,
        z: z0,
      };
      const outer0Top = { ...outer0Bottom, z: z1 };
      const outer1Top = { ...outer1Bottom, z: z1 };
      const inner0Bottom = {
        x: center.x + Math.cos(a0) * innerRadius,
        y: center.y + Math.sin(a0) * innerRadius,
        z: z0,
      };
      const inner1Bottom = {
        x: center.x + Math.cos(a1) * innerRadius,
        y: center.y + Math.sin(a1) * innerRadius,
        z: z0,
      };
      const inner0Top = { ...inner0Bottom, z: z1 };
      const inner1Top = { ...inner1Bottom, z: z1 };

      this.addQuad(outer0Bottom, outer1Bottom, outer1Top, outer0Top);
      this.addQuad(inner1Bottom, inner0Bottom, inner0Top, inner1Top);
      this.addQuad(outer0Top, outer1Top, inner1Top, inner0Top);
      this.addQuad(outer1Bottom, outer0Bottom, inner0Bottom, inner1Bottom);
    }
  }

  addSteppedTube(
    center: Vec3,
    outerRadius: number,
    lowerInnerRadius: number,
    upperInnerRadius: number,
    height: number,
    upperDepth: number,
    segments: number,
  ): void {
    const z0 = center.z;
    const z1 = center.z + height;
    const zStep = Math.max(z0, Math.min(z1, z1 - upperDepth));

    for (let i = 0; i < segments; i += 1) {
      const a0 = (Math.PI * 2 * i) / segments;
      const a1 = (Math.PI * 2 * (i + 1)) / segments;
      const outerBottom0 = radialPoint(center, outerRadius, a0, z0);
      const outerBottom1 = radialPoint(center, outerRadius, a1, z0);
      const outerStep0 = radialPoint(center, outerRadius, a0, zStep);
      const outerStep1 = radialPoint(center, outerRadius, a1, zStep);
      const outerTop0 = radialPoint(center, outerRadius, a0, z1);
      const outerTop1 = radialPoint(center, outerRadius, a1, z1);
      const lowerBottom0 = radialPoint(center, lowerInnerRadius, a0, z0);
      const lowerBottom1 = radialPoint(center, lowerInnerRadius, a1, z0);
      const lowerStep0 = radialPoint(center, lowerInnerRadius, a0, zStep);
      const lowerStep1 = radialPoint(center, lowerInnerRadius, a1, zStep);
      const upperStep0 = radialPoint(center, upperInnerRadius, a0, zStep);
      const upperStep1 = radialPoint(center, upperInnerRadius, a1, zStep);
      const upperTop0 = radialPoint(center, upperInnerRadius, a0, z1);
      const upperTop1 = radialPoint(center, upperInnerRadius, a1, z1);

      this.addQuad(outerBottom0, outerBottom1, outerStep1, outerStep0);
      this.addQuad(outerStep0, outerStep1, outerTop1, outerTop0);
      this.addQuad(lowerBottom1, lowerBottom0, lowerStep0, lowerStep1);
      this.addQuad(upperStep1, upperStep0, upperTop0, upperTop1);
      this.addQuad(outerTop0, outerTop1, upperTop1, upperTop0);
      this.addQuad(outerBottom1, outerBottom0, lowerBottom0, lowerBottom1);
      this.addQuad(upperStep0, upperStep1, lowerStep1, lowerStep0);
    }
  }

  build(): TriangleMesh {
    return {
      vertices: [...this.vertices],
      indices: [...this.indices],
      groups: [...this.groups],
      units: 'mm',
    };
  }
}

function radialPoint(center: Vec3, radius: number, angle: number, z: number): Vec3 {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
    z,
  };
}

export function roundedRectanglePoints(width: number, height: number, radius: number, segments = 8): Vec2[] {
  const clampedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (clampedRadius === 0) {
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  }

  const points: Vec2[] = [];
  const corners = [
    { cx: width - clampedRadius, cy: clampedRadius, start: -Math.PI / 2 },
    { cx: width - clampedRadius, cy: height - clampedRadius, start: 0 },
    { cx: clampedRadius, cy: height - clampedRadius, start: Math.PI / 2 },
    { cx: clampedRadius, cy: clampedRadius, start: Math.PI },
  ];

  for (const corner of corners) {
    for (let i = 0; i <= segments; i += 1) {
      const angle = corner.start + (i / segments) * (Math.PI / 2);
      points.push({
        x: corner.cx + Math.cos(angle) * clampedRadius,
        y: corner.cy + Math.sin(angle) * clampedRadius,
      });
    }
  }

  return points;
}

export function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const cross = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  return Math.hypot(cross.x, cross.y, cross.z) / 2;
}

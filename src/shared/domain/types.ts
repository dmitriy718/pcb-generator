export type Millimeters = number;

export type MaterialId = 'pla' | 'petg' | 'abs' | 'asa' | 'tpu' | 'cf_pla' | 'nylon';

export interface MaterialProfile {
  id: MaterialId;
  name: string;
  clearance: Millimeters;
  snapFitClearance: Millimeters;
  holeCompensation: Millimeters;
  wallThickness: Millimeters;
  minimumFeatureSize: Millimeters;
  recommendedLayerHeight: Millimeters;
  recommendedInfillPercent: number;
  bambuProfileHint: string;
}

export interface MountingHole {
  id: string;
  x: Millimeters;
  y: Millimeters;
  diameter: Millimeters;
}

export type CutoutSide = 'front' | 'back' | 'left' | 'right';

export interface ConnectorCutout {
  id: string;
  label: string;
  side: CutoutSide;
  offset: Millimeters;
  z: Millimeters;
  width: Millimeters;
  height: Millimeters;
}

export interface VentilationRegion {
  id: string;
  label: string;
  x: Millimeters;
  y: Millimeters;
  width: Millimeters;
  height: Millimeters;
  slotWidth: Millimeters;
  slotHeight: Millimeters;
  spacing: Millimeters;
}

export type DesignFeatureKind =
  | 'display_opening'
  | 'button_opening'
  | 'antenna_hole'
  | 'speaker_grill'
  | 'fan_grill'
  | 'battery_tray'
  | 'label_recess'
  | 'text_engraving'
  | 'logo_badge'
  | 'cable_slot'
  | 'zip_tie_anchor'
  | 'qr_recess'
  | 'din_rail_clip';

export type DesignFeatureShape = 'rectangle' | 'rounded_rectangle' | 'circle';

export type DesignFeatureOperation = 'through_cut' | 'recess' | 'emboss';

export interface DesignFeatureCustomFootprint {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  cornerRadiusRatio: number;
}

export interface DesignFeature {
  id: string;
  label: string;
  kind: DesignFeatureKind;
  shape: DesignFeatureShape;
  operation: DesignFeatureOperation;
  x: Millimeters;
  y: Millimeters;
  width: Millimeters;
  height: Millimeters;
  diameter: Millimeters;
  depth: Millimeters;
  cornerRadius: Millimeters;
  spacing: Millimeters;
  rows: number;
  columns: number;
  text: string;
  customFootprints?: DesignFeatureCustomFootprint[] | undefined;
}

export interface PcbSpecification {
  width: Millimeters;
  height: Millimeters;
  thickness: Millimeters;
  componentHeight: Millimeters;
  cornerRadius: Millimeters;
  mountingHoles: MountingHole[];
  connectorCutouts: ConnectorCutout[];
}

export interface BoardProfile {
  id: string;
  name: string;
  family: string;
  source: 'built_in' | 'custom';
  notes: string;
  pcb: PcbSpecification;
}

export interface TwoPieceScrewCaseParameters {
  type: 'two_piece_screw_case';
  material: MaterialId;
  fastenerProfileId: string;
  wallThickness: Millimeters;
  floorThickness: Millimeters;
  lidThickness: Millimeters;
  baseInternalHeight: Millimeters;
  boardClearance: Millimeters;
  lidGap: Millimeters;
  cornerRadius: Millimeters;
  standoffDiameter: Millimeters;
  standoffHoleDiameter: Millimeters;
  standoffHeight: Millimeters;
  screwBossDiameter: Millimeters;
  screwHoleDiameter: Millimeters;
  chamfer: Millimeters;
  ventilationRegions: VentilationRegion[];
  designFeatures: DesignFeature[];
}

export type EnclosureParameters = TwoPieceScrewCaseParameters;

export interface EnclosureProject {
  name: string;
  pcb: PcbSpecification;
  enclosure: EnclosureParameters;
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface MeshGroup {
  name: string;
  start: number;
  count: number;
}

export interface TriangleMesh {
  vertices: number[];
  indices: number[];
  groups: MeshGroup[];
  units: 'mm';
}

export interface MeshTopologyReport {
  vertexCount: number;
  triangleCount: number;
  edgeCount: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  duplicateTriangles: number;
  reversedDuplicateTriangles: number;
  isClosed: boolean;
  isEdgeManifold: boolean;
}

export interface GeneratedEnclosure {
  mesh: TriangleMesh;
  metadata: ManufacturingMetadata;
}

export interface ManufacturingMetadata {
  modelName: string;
  material: MaterialProfile;
  printOrientation: string;
  supportRequired: boolean;
  layerHeight: Millimeters;
  infillPercent: number;
  estimatedFilamentGrams: number;
  estimatedPrintMinutes: number;
  assemblyInstructions: string[];
  makerWorld: {
    title: string;
    summary: string;
    tags: string[];
  };
  layout: {
    modelArrangement: string;
    printableParts: string[];
  };
  meshTopology: MeshTopologyReport;
  printability: PrintabilityReport;
}

export type ExportFormat =
  | 'stl'
  | 'obj'
  | '3mf'
  | 'step'
  | 'svg'
  | 'dxf'
  | 'gltf'
  | 'bom'
  | 'assembly-svg';

export type PrintabilitySeverity = 'info' | 'warning' | 'error';

export interface PrintabilityIssue {
  severity: PrintabilitySeverity;
  code: string;
  message: string;
  recommendation: string;
}

export interface PrintabilityReport {
  overall: 'ready' | 'review' | 'blocked';
  outerDimensions: {
    width: Millimeters;
    height: Millimeters;
    baseHeight: Millimeters;
    lidHeight: Millimeters;
  };
  recommendedOrientation: string;
  supportRequired: boolean;
  materialProfile: string;
  bambuProfileHint: string;
  issues: PrintabilityIssue[];
}

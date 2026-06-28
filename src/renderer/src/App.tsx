import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Download,
  Eye,
  FileType,
  FolderOpen,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { generateTwoPieceScrewCase } from '../../shared/cad';
import { boardProfileById, builtInBoardProfiles } from '../../shared/boards';
import { defaultProject, materialProfiles, validateProject } from '../../shared/domain';
import { builtInFastenerProfiles, fastenerProfileById } from '../../shared/fasteners';
import type {
  ConnectorCutout,
  CutoutSide,
  BoardProfile,
  EnclosureProject,
  ExportFormat,
  MaterialId,
  MountingHole,
  VentilationRegion,
} from '../../shared/domain';
import { PreviewViewport } from './components/PreviewViewport';

type NumericProjectPath =
  | 'pcb.width'
  | 'pcb.height'
  | 'pcb.thickness'
  | 'pcb.cornerRadius'
  | 'enclosure.wallThickness'
  | 'enclosure.floorThickness'
  | 'enclosure.lidThickness'
  | 'enclosure.baseInternalHeight'
  | 'enclosure.boardClearance'
  | 'enclosure.lidGap'
  | 'enclosure.cornerRadius'
  | 'enclosure.standoffDiameter'
  | 'enclosure.standoffHoleDiameter'
  | 'enclosure.standoffHeight'
  | 'enclosure.screwBossDiameter'
  | 'enclosure.screwHoleDiameter'
  | 'enclosure.chamfer';

export function App(): ReactElement {
  const [project, setProject] = useState<EnclosureProject>(defaultProject);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const validation = useMemo(() => validateProject(project), [project]);
  const generated = useMemo(() => {
    if (!validation.ok) {
      return undefined;
    }
    return generateTwoPieceScrewCase(project);
  }, [project, validation.ok]);

  const outerDimensions = useMemo(() => {
    const internalWidth = project.pcb.width + project.enclosure.boardClearance * 2;
    const internalHeight = project.pcb.height + project.enclosure.boardClearance * 2;
    return {
      width: internalWidth + project.enclosure.wallThickness * 2,
      height: internalHeight + project.enclosure.wallThickness * 2,
      baseHeight:
        project.enclosure.floorThickness +
        project.enclosure.standoffHeight +
        project.pcb.thickness +
        project.enclosure.baseInternalHeight,
    };
  }, [project]);

  function updateNumber(path: NumericProjectPath, value: number): void {
    setProject((current) => {
      const next = structuredClone(current);
      const [section, key] = path.split('.') as ['pcb' | 'enclosure', string];
      if (section === 'pcb') {
        next.pcb = { ...next.pcb, [key]: value };
      } else {
        next.enclosure = { ...next.enclosure, [key]: value };
      }
      return next;
    });
  }

  function applyBoardProfile(profileId: string): void {
    const profile = boardProfileById(profileId);
    if (!profile) {
      return;
    }
    applyBoardProfileObject(profile);
  }

  function applyBoardProfileObject(profile: BoardProfile): void {
    setProject((current) => ({
      ...current,
      name: `${profile.name} Enclosure`,
      pcb: structuredClone(profile.pcb),
    }));
    setImportWarnings([profile.notes]);
    setExportMessage(`Applied ${profile.name} board profile.`);
  }

  function pcbApi(): Window['pcbEnclosure'] | undefined {
    return window.pcbEnclosure;
  }

  function formatActionError(action: string, error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return `${action} failed: ${message}`;
  }

  async function importBoardProfile(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.importBoardProfile();
      if (!result.imported) {
        setExportMessage('Board profile import cancelled.');
        return;
      }

      applyBoardProfileObject(result.profile);
      setExportMessage(`Imported board profile ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('Board profile import', error));
    }
  }

  async function saveCurrentBoardProfile(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.saveCurrentBoardProfile(project);
      setExportMessage(
        result.saved
          ? `Saved board profile ${result.filePath}.`
          : 'Board profile save cancelled.',
      );
    } catch (error) {
      setExportMessage(formatActionError('Board profile save', error));
    }
  }

  function applyFastenerProfile(profileId: string): void {
    const profile = fastenerProfileById(profileId);
    if (!profile) {
      return;
    }
    setProject((current) => ({
      ...current,
      enclosure: {
        ...current.enclosure,
        fastenerProfileId: profile.id,
        standoffDiameter: profile.standoffDiameter,
        standoffHoleDiameter: profile.standoffHoleDiameter,
        standoffHeight: profile.recommendedStandoffHeight,
        screwBossDiameter: profile.screwBossDiameter,
        screwHoleDiameter: profile.screwHoleDiameter,
      },
    }));
    setImportWarnings([profile.notes]);
    setExportMessage(`Applied ${profile.name} fastener profile.`);
  }

  function updateMountingHole(id: string, patch: Partial<Omit<MountingHole, 'id'>>): void {
    setProject((current) => ({
      ...current,
      pcb: {
        ...current.pcb,
        mountingHoles: current.pcb.mountingHoles.map((hole) =>
          hole.id === id ? { ...hole, ...patch } : hole,
        ),
      },
    }));
  }

  function addMountingHole(): void {
    setProject((current) => ({
      ...current,
      pcb: {
        ...current.pcb,
        mountingHoles: [
          ...current.pcb.mountingHoles,
          {
            id: `mh-${crypto.randomUUID().slice(0, 8)}`,
            x: Math.round(current.pcb.width / 2),
            y: Math.round(current.pcb.height / 2),
            diameter: 3,
          },
        ],
      },
    }));
  }

  function removeMountingHole(id: string): void {
    setProject((current) => ({
      ...current,
      pcb: {
        ...current.pcb,
        mountingHoles: current.pcb.mountingHoles.filter((hole) => hole.id !== id),
      },
    }));
  }

  function updateConnectorCutout(id: string, patch: Partial<Omit<ConnectorCutout, 'id'>>): void {
    setProject((current) => ({
      ...current,
      pcb: {
        ...current.pcb,
        connectorCutouts: current.pcb.connectorCutouts.map((cutout) =>
          cutout.id === id ? { ...cutout, ...patch } : cutout,
        ),
      },
    }));
  }

  function addConnectorCutout(): void {
    setProject((current) => ({
      ...current,
      pcb: {
        ...current.pcb,
        connectorCutouts: [
          ...current.pcb.connectorCutouts,
          {
            id: `cutout-${crypto.randomUUID().slice(0, 8)}`,
            label: 'Connector',
            side: 'front',
            offset: Math.round(current.pcb.width / 2),
            z: current.enclosure.floorThickness + 5,
            width: 10,
            height: 5,
          },
        ],
      },
    }));
  }

  function removeConnectorCutout(id: string): void {
    setProject((current) => ({
      ...current,
      pcb: {
        ...current.pcb,
        connectorCutouts: current.pcb.connectorCutouts.filter((cutout) => cutout.id !== id),
      },
    }));
  }

  function updateVentilationRegion(id: string, patch: Partial<Omit<VentilationRegion, 'id'>>): void {
    setProject((current) => ({
      ...current,
      enclosure: {
        ...current.enclosure,
        ventilationRegions: current.enclosure.ventilationRegions.map((region) =>
          region.id === id ? { ...region, ...patch } : region,
        ),
      },
    }));
  }

  function addVentilationRegion(): void {
    setProject((current) => {
      const internalWidth = current.pcb.width + current.enclosure.boardClearance * 2;
      const internalHeight = current.pcb.height + current.enclosure.boardClearance * 2;
      return {
        ...current,
        enclosure: {
          ...current.enclosure,
          ventilationRegions: [
            ...current.enclosure.ventilationRegions,
            {
              id: `vent-${crypto.randomUUID().slice(0, 8)}`,
              label: 'Lid vents',
              x: Math.round((internalWidth + current.enclosure.wallThickness * 2) / 2),
              y: Math.round((internalHeight + current.enclosure.wallThickness * 2) / 2),
              width: 24,
              height: 10,
              slotWidth: 3,
              slotHeight: 8,
              spacing: 3,
            },
          ],
        },
      };
    });
  }

  function removeVentilationRegion(id: string): void {
    setProject((current) => ({
      ...current,
      enclosure: {
        ...current.enclosure,
        ventilationRegions: current.enclosure.ventilationRegions.filter((region) => region.id !== id),
      },
    }));
  }

  async function exportProject(format: ExportFormat): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.exportProject(project, format);
      setExportMessage(
        result.saved
          ? `Saved ${result.filePath} and MakerWorld metadata.`
          : 'Export cancelled.',
      );
    } catch (error) {
      setExportMessage(formatActionError(`${format.toUpperCase()} export`, error));
    }
  }

  async function saveProjectFile(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.saveProjectFile(project);
      setExportMessage(result.saved ? `Saved project ${result.filePath}.` : 'Save cancelled.');
    } catch (error) {
      setExportMessage(formatActionError('Project save', error));
    }
  }

  async function openProjectFile(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.openProjectFile();
      if (!result.opened) {
        setExportMessage('Open cancelled.');
        return;
      }
      setProject(result.project);
      setImportWarnings([]);
      setExportMessage(`Opened project ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('Project open', error));
    }
  }

  async function importKiCadProject(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.importKiCadProject();
      if (!result.imported) {
        setExportMessage('Import cancelled.');
        return;
      }

      setProject((current) => ({
        ...current,
        name: result.projectName,
        pcb: result.pcb,
      }));
      setImportWarnings(result.warnings);
      setExportMessage(`Imported ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('KiCad import', error));
    }
  }

  async function importSvgProject(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.importSvgProject();
      if (!result.imported) {
        setExportMessage('SVG import cancelled.');
        return;
      }

      setProject((current) => ({
        ...current,
        name: result.projectName,
        pcb: result.pcb,
      }));
      setImportWarnings(result.warnings);
      setExportMessage(`Imported ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('SVG import', error));
    }
  }

  async function importDxfProject(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.importDxfProject();
      if (!result.imported) {
        setExportMessage('DXF import cancelled.');
        return;
      }

      setProject((current) => ({
        ...current,
        name: result.projectName,
        pcb: result.pcb,
      }));
      setImportWarnings(result.warnings);
      setExportMessage(`Imported ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('DXF import', error));
    }
  }

  async function importStlProject(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.importStlProject();
      if (!result.imported) {
        setExportMessage('STL import cancelled.');
        return;
      }

      setProject((current) => ({
        ...current,
        name: result.projectName,
        pcb: result.pcb,
      }));
      setImportWarnings(result.warnings);
      setExportMessage(`Imported ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('STL import', error));
    }
  }

  async function importStepProject(): Promise<void> {
    setExportMessage('');
    const api = pcbApi();
    if (!api) {
      setExportMessage('Desktop integration is unavailable. Launch the Electron app instead of the browser preview.');
      return;
    }
    try {
      const result = await api.importStepProject();
      if (!result.imported) {
        setExportMessage('STEP import cancelled.');
        return;
      }

      setProject((current) => ({
        ...current,
        name: result.projectName,
        pcb: result.pcb,
      }));
      setImportWarnings(result.warnings);
      setExportMessage(`Imported ${result.sourcePath}.`);
    } catch (error) {
      setExportMessage(formatActionError('STEP import', error));
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Box size={20} aria-hidden="true" />
          <div>
            <h1>PCB Enclosure Generator</h1>
            <span>Manual PCB to two-piece screw enclosure</span>
          </div>
        </div>
        <div className="status-strip" aria-live="polite">
          {validation.ok ? (
            <span className="status-pill valid">
              <CheckCircle2 size={16} aria-hidden="true" /> Valid
            </span>
          ) : (
            <span className="status-pill error">
              <AlertTriangle size={16} aria-hidden="true" /> {validation.issues.length} issue
              {validation.issues.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="unit-pill">mm</span>
          <button className="toolbar-button" type="button" onClick={() => void openProjectFile()}>
            <FolderOpen size={16} aria-hidden="true" /> Open
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!validation.ok}
            onClick={() => void saveProjectFile()}
          >
            <Save size={16} aria-hidden="true" /> Save
          </button>
          <button className="toolbar-button" type="button" onClick={() => void importKiCadProject()}>
            <Upload size={16} aria-hidden="true" /> KiCad
          </button>
          <button className="toolbar-button" type="button" onClick={() => void importSvgProject()}>
            <Upload size={16} aria-hidden="true" /> SVG
          </button>
          <button className="toolbar-button" type="button" onClick={() => void importDxfProject()}>
            <Upload size={16} aria-hidden="true" /> DXF
          </button>
          <button className="toolbar-button" type="button" onClick={() => void importStlProject()}>
            <Upload size={16} aria-hidden="true" /> STL
          </button>
          <button className="toolbar-button" type="button" onClick={() => void importStepProject()}>
            <Upload size={16} aria-hidden="true" /> STEP
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!validation.ok}
            onClick={() => void exportProject('3mf')}
          >
            <Download size={16} aria-hidden="true" /> 3MF
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!validation.ok}
            onClick={() => void exportProject('stl')}
          >
            <Download size={16} aria-hidden="true" /> STL
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!validation.ok}
            onClick={() => void exportProject('obj')}
          >
            <Download size={16} aria-hidden="true" /> OBJ
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!validation.ok}
            onClick={() => void exportProject('svg')}
          >
            <Download size={16} aria-hidden="true" /> SVG
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel parameter-panel" aria-label="Parameters">
          <label className="field wide">
            <span>Project name</span>
            <input
              value={project.name}
              onChange={(event) => setProject({ ...project, name: event.target.value })}
            />
          </label>

          <fieldset>
            <legend>Board Library</legend>
            <label className="field wide">
              <span>Built-in template</span>
              <select defaultValue="" onChange={(event) => applyBoardProfile(event.target.value)}>
                <option value="" disabled>
                  Select a board profile
                </option>
                {builtInBoardProfiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.family} - {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" onClick={() => void importBoardProfile()}>
              Import board profile
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!validation.ok}
              onClick={() => void saveCurrentBoardProfile()}
            >
              Save current board profile
            </button>
          </fieldset>

          <fieldset>
            <legend>PCB Dimensions</legend>
            <NumberField label="Width" value={project.pcb.width} onChange={(value) => updateNumber('pcb.width', value)} />
            <NumberField label="Height" value={project.pcb.height} onChange={(value) => updateNumber('pcb.height', value)} />
            <NumberField
              label="Thickness"
              value={project.pcb.thickness}
              step={0.1}
              onChange={(value) => updateNumber('pcb.thickness', value)}
            />
            <NumberField
              label="Corner radius"
              value={project.pcb.cornerRadius}
              step={0.1}
              onChange={(value) => updateNumber('pcb.cornerRadius', value)}
            />
          </fieldset>

          <fieldset>
            <legend>Mounting Holes</legend>
            <div className="hole-table" role="table" aria-label="Mounting holes">
              <div className="hole-row header" role="row">
                <span>X</span>
                <span>Y</span>
                <span>Dia</span>
                <span />
              </div>
              {project.pcb.mountingHoles.map((hole) => (
                <div className="hole-row" role="row" key={hole.id}>
                  <input
                    aria-label={`${hole.id} x position`}
                    type="number"
                    value={hole.x}
                    onChange={(event) => updateMountingHole(hole.id, { x: event.currentTarget.valueAsNumber })}
                  />
                  <input
                    aria-label={`${hole.id} y position`}
                    type="number"
                    value={hole.y}
                    onChange={(event) => updateMountingHole(hole.id, { y: event.currentTarget.valueAsNumber })}
                  />
                  <input
                    aria-label={`${hole.id} diameter`}
                    type="number"
                    value={hole.diameter}
                    step={0.1}
                    onChange={(event) =>
                      updateMountingHole(hole.id, { diameter: event.currentTarget.valueAsNumber })
                    }
                  />
                  <button type="button" className="icon-button" onClick={() => removeMountingHole(hole.id)}>
                    x
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary-button" onClick={addMountingHole}>
              Add hole
            </button>
          </fieldset>

          <fieldset>
            <legend>Connector Cutouts</legend>
            <div className="cutout-list">
              {project.pcb.connectorCutouts.map((cutout) => (
                <div className="cutout-editor" key={cutout.id}>
                  <label className="field">
                    <span>Label</span>
                    <input
                      value={cutout.label}
                      onChange={(event) => updateConnectorCutout(cutout.id, { label: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Side</span>
                    <select
                      value={cutout.side}
                      onChange={(event) =>
                        updateConnectorCutout(cutout.id, { side: event.target.value as CutoutSide })
                      }
                    >
                      <option value="front">Front</option>
                      <option value="back">Back</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <NumberField
                    label="Offset"
                    value={cutout.offset}
                    step={0.1}
                    onChange={(value) => updateConnectorCutout(cutout.id, { offset: value })}
                  />
                  <NumberField
                    label="Z center"
                    value={cutout.z}
                    step={0.1}
                    onChange={(value) => updateConnectorCutout(cutout.id, { z: value })}
                  />
                  <NumberField
                    label="Width"
                    value={cutout.width}
                    step={0.1}
                    onChange={(value) => updateConnectorCutout(cutout.id, { width: value })}
                  />
                  <NumberField
                    label="Height"
                    value={cutout.height}
                    step={0.1}
                    onChange={(value) => updateConnectorCutout(cutout.id, { height: value })}
                  />
                  <button
                    type="button"
                    className="secondary-button danger"
                    onClick={() => removeConnectorCutout(cutout.id)}
                  >
                    Remove cutout
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary-button" onClick={addConnectorCutout}>
              Add cutout
            </button>
          </fieldset>

          <fieldset>
            <legend>Enclosure</legend>
            <NumberField
              label="Wall"
              value={project.enclosure.wallThickness}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.wallThickness', value)}
            />
            <NumberField
              label="Floor"
              value={project.enclosure.floorThickness}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.floorThickness', value)}
            />
            <NumberField
              label="Lid"
              value={project.enclosure.lidThickness}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.lidThickness', value)}
            />
            <NumberField
              label="Internal height"
              value={project.enclosure.baseInternalHeight}
              step={0.5}
              onChange={(value) => updateNumber('enclosure.baseInternalHeight', value)}
            />
            <NumberField
              label="Board clearance"
              value={project.enclosure.boardClearance}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.boardClearance', value)}
            />
            <NumberField
              label="Lid gap"
              value={project.enclosure.lidGap}
              step={0.05}
              onChange={(value) => updateNumber('enclosure.lidGap', value)}
            />
            <NumberField
              label="Case radius"
              value={project.enclosure.cornerRadius}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.cornerRadius', value)}
            />
            <NumberField
              label="Chamfer"
              value={project.enclosure.chamfer}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.chamfer', value)}
            />
          </fieldset>

          <fieldset>
            <legend>Ventilation</legend>
            <div className="cutout-list">
              {project.enclosure.ventilationRegions.map((region) => (
                <div className="cutout-editor" key={region.id}>
                  <label className="field">
                    <span>Label</span>
                    <input
                      value={region.label}
                      onChange={(event) => updateVentilationRegion(region.id, { label: event.target.value })}
                    />
                  </label>
                  <NumberField
                    label="X center"
                    value={region.x}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { x: value })}
                  />
                  <NumberField
                    label="Y center"
                    value={region.y}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { y: value })}
                  />
                  <NumberField
                    label="Region width"
                    value={region.width}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { width: value })}
                  />
                  <NumberField
                    label="Region height"
                    value={region.height}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { height: value })}
                  />
                  <NumberField
                    label="Slot width"
                    value={region.slotWidth}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { slotWidth: value })}
                  />
                  <NumberField
                    label="Slot height"
                    value={region.slotHeight}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { slotHeight: value })}
                  />
                  <NumberField
                    label="Spacing"
                    value={region.spacing}
                    step={0.1}
                    onChange={(value) => updateVentilationRegion(region.id, { spacing: value })}
                  />
                  <button
                    type="button"
                    className="secondary-button danger"
                    onClick={() => removeVentilationRegion(region.id)}
                  >
                    Remove vent
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary-button" onClick={addVentilationRegion}>
              Add ventilation
            </button>
          </fieldset>

          <fieldset>
            <legend>Fasteners</legend>
            <label className="field wide">
              <span>Hardware profile</span>
              <select
                value={project.enclosure.fastenerProfileId}
                onChange={(event) => applyFastenerProfile(event.target.value)}
              >
                {builtInFastenerProfiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Standoff OD"
              value={project.enclosure.standoffDiameter}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.standoffDiameter', value)}
            />
            <NumberField
              label="Standoff hole"
              value={project.enclosure.standoffHoleDiameter}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.standoffHoleDiameter', value)}
            />
            <NumberField
              label="Standoff height"
              value={project.enclosure.standoffHeight}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.standoffHeight', value)}
            />
            <NumberField
              label="Boss OD"
              value={project.enclosure.screwBossDiameter}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.screwBossDiameter', value)}
            />
            <NumberField
              label="Screw hole"
              value={project.enclosure.screwHoleDiameter}
              step={0.1}
              onChange={(value) => updateNumber('enclosure.screwHoleDiameter', value)}
            />
          </fieldset>

          <fieldset>
            <legend>Material Profile</legend>
            <label className="field wide">
              <span>Material</span>
              <select
                value={project.enclosure.material}
                onChange={(event) =>
                  setProject({
                    ...project,
                    enclosure: { ...project.enclosure, material: event.target.value as MaterialId },
                  })
                }
              >
                {Object.values(materialProfiles).map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <dl className="profile-readout">
              <div>
                <dt>Clearance</dt>
                <dd>{materialProfiles[project.enclosure.material].clearance} mm</dd>
              </div>
              <div>
                <dt>Min feature</dt>
                <dd>{materialProfiles[project.enclosure.material].minimumFeatureSize} mm</dd>
              </div>
              <div>
                <dt>Bambu profile</dt>
                <dd>{materialProfiles[project.enclosure.material].bambuProfileHint}</dd>
              </div>
            </dl>
          </fieldset>
        </aside>

        <section className="viewport-region" aria-label="3D preview">
          <PreviewViewport mesh={generated?.mesh} />
          <div className="viewport-toolbar" aria-label="Viewport controls">
            <button type="button" title="Reset view">
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            <button type="button" title="Show generated enclosure">
              <Eye size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="dimension-readout">
            <span>{outerDimensions.width.toFixed(1)} x {outerDimensions.height.toFixed(1)} mm</span>
            <span>Base height {outerDimensions.baseHeight.toFixed(1)} mm</span>
            <span>{generated ? `${generated.metadata.estimatedFilamentGrams} g estimated` : 'Preview paused'}</span>
          </div>
        </section>

        <aside className="panel inspector-panel" aria-label="Validation and export">
          <section className="inspector-section">
            <h2>Validation</h2>
            {validation.ok ? (
              <p className="empty-state">
                <CheckCircle2 size={16} aria-hidden="true" /> Geometry parameters are valid.
              </p>
            ) : (
              <ul className="validation-list">
                {validation.issues.map((current) => (
                  <li key={`${current.code}-${current.path}`}>
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>{current.message}</span>
                    <code>{current.path}</code>
                  </li>
                ))}
              </ul>
            )}
            {importWarnings.length > 0 ? (
              <ul className="warning-list">
                {importWarnings.map((warning) => (
                  <li key={warning}>
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="inspector-section">
            <h2>Manufacturing</h2>
            {generated ? (
              <dl className="manufacturing-list">
                <div>
                  <dt>Layer height</dt>
                  <dd>{generated.metadata.layerHeight} mm</dd>
                </div>
                <div>
                  <dt>Infill</dt>
                  <dd>{generated.metadata.infillPercent}%</dd>
                </div>
                <div>
                  <dt>Supports</dt>
                  <dd>{generated.metadata.supportRequired ? 'Required' : 'Not required'}</dd>
                </div>
                <div>
                  <dt>Orientation</dt>
                  <dd>{generated.metadata.printOrientation}</dd>
                </div>
                <div>
                  <dt>Printability</dt>
                  <dd>{generated.metadata.printability.overall}</dd>
                </div>
                <div>
                  <dt>Mesh topology</dt>
                  <dd>
                    {generated.metadata.meshTopology.isClosed ? 'Watertight' : 'Open'} /{' '}
                    {generated.metadata.meshTopology.isEdgeManifold ? 'manifold' : 'needs review'}
                  </dd>
                </div>
                <div>
                  <dt>Outer size</dt>
                  <dd>
                    {generated.metadata.printability.outerDimensions.width} x{' '}
                    {generated.metadata.printability.outerDimensions.height} x{' '}
                    {generated.metadata.printability.outerDimensions.baseHeight} mm
                  </dd>
                </div>
                <div>
                  <dt>Bambu profile</dt>
                  <dd>{generated.metadata.printability.bambuProfileHint}</dd>
                </div>
              </dl>
            ) : (
              <p className="empty-state">Resolve validation issues to generate manufacturing data.</p>
            )}
            {generated && generated.metadata.printability.issues.length > 0 ? (
              <ul className="printability-list">
                {generated.metadata.printability.issues.map((issue) => (
                  <li className={issue.severity} key={issue.code}>
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>
                      {issue.message}
                      <small>{issue.recommendation}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="inspector-section">
            <h2>Export</h2>
            <div className="export-actions">
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('3mf')}>
                <FileType size={16} aria-hidden="true" /> Export 3MF
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('step')}>
                <FileType size={16} aria-hidden="true" /> Export STEP
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('stl')}>
                <FileType size={16} aria-hidden="true" /> Export STL
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('obj')}>
                <FileType size={16} aria-hidden="true" /> Export OBJ
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('gltf')}>
                <FileType size={16} aria-hidden="true" /> Export GLTF
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('svg')}>
                <FileType size={16} aria-hidden="true" /> Export SVG drawing
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('dxf')}>
                <FileType size={16} aria-hidden="true" /> Export DXF drawing
              </button>
              <button type="button" disabled={!validation.ok} onClick={() => void exportProject('bom')}>
                <FileType size={16} aria-hidden="true" /> Export BOM CSV
              </button>
            </div>
            <p className="export-note">
              Exports include a MakerWorld metadata JSON file next to the model.
            </p>
            {exportMessage ? <p className="export-message">{exportMessage}</p> : null}
          </section>
        </aside>
      </section>
    </main>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="number-control">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={0}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        />
        <em>mm</em>
      </span>
    </label>
  );
}

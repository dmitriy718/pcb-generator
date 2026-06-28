import { contextBridge, ipcRenderer } from 'electron';
import type {
  BoardProfile,
  EnclosureProject,
  ExportFormat,
  PcbSpecification,
  ValidationResult,
} from '../shared/domain';

const api = {
  validateProject: (project: EnclosureProject): Promise<ValidationResult> =>
    ipcRenderer.invoke('project:validate', project) as Promise<ValidationResult>,
  saveProjectFile: (
    project: EnclosureProject,
  ): Promise<{ saved: false } | { saved: true; filePath: string }> =>
    ipcRenderer.invoke('project:save-file', project) as Promise<
      { saved: false } | { saved: true; filePath: string }
    >,
  openProjectFile: (): Promise<
    { opened: false } | { opened: true; sourcePath: string; project: EnclosureProject }
  > =>
    ipcRenderer.invoke('project:open-file') as Promise<
      { opened: false } | { opened: true; sourcePath: string; project: EnclosureProject }
    >,
  saveCurrentBoardProfile: (
    project: EnclosureProject,
  ): Promise<{ saved: false } | { saved: true; filePath: string; profile: BoardProfile }> =>
    ipcRenderer.invoke('board-profile:save-current', project) as Promise<
      { saved: false } | { saved: true; filePath: string; profile: BoardProfile }
    >,
  importBoardProfile: (): Promise<
    { imported: false } | { imported: true; sourcePath: string; profile: BoardProfile }
  > =>
    ipcRenderer.invoke('board-profile:open') as Promise<
      { imported: false } | { imported: true; sourcePath: string; profile: BoardProfile }
    >,
  exportProject: (
    project: EnclosureProject,
    format: ExportFormat,
  ): Promise<{ saved: false } | { saved: true; filePath: string; metadataPath: string }> =>
    ipcRenderer.invoke('project:export', project, format) as Promise<
      { saved: false } | { saved: true; filePath: string; metadataPath: string }
    >,
  importKiCadProject: (): Promise<
    | { imported: false }
    | {
        imported: true;
        sourcePath: string;
        projectName: string;
        pcb: PcbSpecification;
        warnings: string[];
      }
  > =>
    ipcRenderer.invoke('project:import-kicad') as Promise<
      | { imported: false }
      | {
          imported: true;
          sourcePath: string;
          projectName: string;
          pcb: PcbSpecification;
          warnings: string[];
      }
    >,
  importSvgProject: (): Promise<
    | { imported: false }
    | {
        imported: true;
        sourcePath: string;
        projectName: string;
        pcb: PcbSpecification;
        warnings: string[];
      }
  > =>
    ipcRenderer.invoke('project:import-svg') as Promise<
      | { imported: false }
      | {
          imported: true;
          sourcePath: string;
          projectName: string;
          pcb: PcbSpecification;
          warnings: string[];
        }
    >,
  importDxfProject: (): Promise<
    | { imported: false }
    | {
        imported: true;
        sourcePath: string;
        projectName: string;
        pcb: PcbSpecification;
        warnings: string[];
      }
  > =>
    ipcRenderer.invoke('project:import-dxf') as Promise<
      | { imported: false }
      | {
          imported: true;
          sourcePath: string;
          projectName: string;
          pcb: PcbSpecification;
          warnings: string[];
        }
    >,
  importStlProject: (): Promise<
    | { imported: false }
    | {
        imported: true;
        sourcePath: string;
        projectName: string;
        pcb: PcbSpecification;
        warnings: string[];
      }
  > =>
    ipcRenderer.invoke('project:import-stl') as Promise<
      | { imported: false }
      | {
          imported: true;
          sourcePath: string;
          projectName: string;
          pcb: PcbSpecification;
          warnings: string[];
        }
    >,
};

contextBridge.exposeInMainWorld('pcbEnclosure', api);

export type PcbEnclosureApi = typeof api;

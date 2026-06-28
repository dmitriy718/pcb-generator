import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log/main';
import { generateTwoPieceScrewCase } from '../shared/cad';
import {
  exportTwoPieceScrewCaseStep,
  generateTwoPieceScrewCaseKernelMesh,
  importStepPcbReference,
} from '../shared/cad/kernel/openCascadeBackend';
import { analyzeMeshTopology } from '../shared/cad/meshValidation';
import type { BoardProfile, EnclosureProject, ExportFormat, GeneratedEnclosure, TriangleMesh } from '../shared/domain';
import { validateProject } from '../shared/domain';
import {
  exportBomCsv,
  exportAsciiStl,
  exportDxfDrawing,
  exportGltf,
  exportMakerWorldMetadata,
  exportObj,
  exportSvgDrawing,
  exportThreeMf,
} from '../shared/exporters';
import { importDxfPcb, importKiCadPcb, importStlPcb, importSvgPcb } from '../shared/importers';
import { parseProjectFile, serializeProjectFile } from '../shared/projectFiles';
import { parseBoardProfileFile, serializeBoardProfileFile, slugify } from '../shared/boards';

log.initialize();

const isSmokeTest = process.env.PCB_EG_SMOKE_TEST === '1';
const shouldDisableGpu = process.env.PCB_EG_DISABLE_GPU === '1' || process.env.CI === 'true';
const shouldUseHeadlessSwitches = process.env.PCB_EG_HEADLESS === '1';

if (shouldDisableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
}

if (shouldUseHeadlessSwitches) {
  app.commandLine.appendSwitch('headless');
  app.commandLine.appendSwitch('ozone-platform', 'headless');
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'PCB Enclosure Generator',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (isSmokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      void mainWindow.webContents
        .executeJavaScript(
          "Boolean(window.pcbEnclosure && window.pcbEnclosure.saveProjectFile && window.pcbEnclosure.exportProject && window.pcbEnclosure.importStlProject && window.pcbEnclosure.importStepProject)",
        )
        .then((hasPreloadBridge: boolean) => {
          if (!hasPreloadBridge) {
            log.error('Electron smoke test failed: preload IPC bridge is unavailable.');
            process.exitCode = 1;
            app.quit();
            return;
          }
          log.info('Electron smoke test loaded renderer and preload bridge successfully.');
          setTimeout(() => app.quit(), 250);
        })
        .catch((error: unknown) => {
          log.error('Electron smoke test failed while checking preload bridge.', error);
          process.exitCode = 1;
          app.quit();
        });
    });

    mainWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
      log.error(`Electron smoke test failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`);
      process.exitCode = 1;
      app.quit();
    });
  }

  return mainWindow;
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pcb-enclosure-generator.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  ipcMain.handle('project:validate', (_event, project: EnclosureProject) => validateProject(project));

  ipcMain.handle('project:save-file', async (_event, project: EnclosureProject) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save PCB Enclosure Project',
      defaultPath: `${project.name.replace(/[^A-Za-z0-9_-]/g, '_')}.pcbenc.json`,
      filters: [{ name: 'PCB Enclosure Project', extensions: ['pcbenc.json'] }],
    });

    if (canceled || !filePath) {
      return { saved: false as const };
    }

    const normalizedFilePath = ensureExtension(filePath, 'pcbenc.json');
    await writeFile(normalizedFilePath, serializeProjectFile(project), 'utf8');
    return { saved: true as const, filePath: normalizedFilePath };
  });

  ipcMain.handle('project:open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open PCB Enclosure Project',
      properties: ['openFile'],
      filters: [{ name: 'PCB Enclosure Project', extensions: ['pcbenc.json', 'json'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { opened: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { opened: false as const };
    }

    const contents = await readFile(sourcePath, 'utf8');
    return { opened: true as const, sourcePath, project: parseProjectFile(contents) };
  });

  ipcMain.handle('board-profile:save-current', async (_event, project: EnclosureProject) => {
    const profile: BoardProfile = {
      id: slugify(project.name.replace(/\s+enclosure$/i, '')),
      name: project.name.replace(/\s+enclosure$/i, '') || project.name,
      family: 'Custom',
      source: 'custom',
      notes: 'Custom board profile exported from PCB Enclosure Generator.',
      pcb: project.pcb,
    };
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Board Profile',
      defaultPath: `${profile.id}.pcbboard.json`,
      filters: [{ name: 'PCB Board Profile', extensions: ['pcbboard.json'] }],
    });

    if (canceled || !filePath) {
      return { saved: false as const };
    }

    const normalizedFilePath = ensureExtension(filePath, 'pcbboard.json');
    await writeFile(normalizedFilePath, serializeBoardProfileFile(profile), 'utf8');
    return { saved: true as const, filePath: normalizedFilePath, profile };
  });

  ipcMain.handle('board-profile:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Board Profile',
      properties: ['openFile'],
      filters: [{ name: 'PCB Board Profile', extensions: ['pcbboard.json', 'json'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { imported: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { imported: false as const };
    }

    const contents = await readFile(sourcePath, 'utf8');
    const profile = parseBoardProfileFile(contents);
    return { imported: true as const, sourcePath, profile };
  });

  ipcMain.handle('project:import-kicad', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import KiCad PCB',
      properties: ['openFile'],
      filters: [{ name: 'KiCad PCB', extensions: ['kicad_pcb'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { imported: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { imported: false as const };
    }

    const contents = await readFile(sourcePath, 'utf8');
    const imported = importKiCadPcb(contents);
    return {
      imported: true as const,
      sourcePath,
      projectName: basename(sourcePath, '.kicad_pcb'),
      pcb: imported.pcb,
      warnings: imported.warnings,
    };
  });

  ipcMain.handle('project:import-svg', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import SVG PCB Outline',
      properties: ['openFile'],
      filters: [{ name: 'SVG PCB Outline', extensions: ['svg'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { imported: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { imported: false as const };
    }

    const contents = await readFile(sourcePath, 'utf8');
    const imported = importSvgPcb(contents);
    return {
      imported: true as const,
      sourcePath,
      projectName: basename(sourcePath, '.svg'),
      pcb: imported.pcb,
      warnings: imported.warnings,
    };
  });

  ipcMain.handle('project:import-dxf', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import DXF PCB Outline',
      properties: ['openFile'],
      filters: [{ name: 'DXF PCB Outline', extensions: ['dxf'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { imported: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { imported: false as const };
    }

    const contents = await readFile(sourcePath, 'utf8');
    const imported = importDxfPcb(contents);
    return {
      imported: true as const,
      sourcePath,
      projectName: basename(sourcePath, '.dxf'),
      pcb: imported.pcb,
      warnings: imported.warnings,
    };
  });

  ipcMain.handle('project:import-stl', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import STL PCB Reference',
      properties: ['openFile'],
      filters: [{ name: 'STL PCB Reference', extensions: ['stl'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { imported: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { imported: false as const };
    }

    const contents = await readFile(sourcePath);
    const imported = importStlPcb(contents);
    return {
      imported: true as const,
      sourcePath,
      projectName: basename(sourcePath, '.stl'),
      pcb: imported.pcb,
      warnings: imported.warnings,
    };
  });

  ipcMain.handle('project:import-step', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import STEP PCB Reference',
      properties: ['openFile'],
      filters: [{ name: 'STEP PCB Reference', extensions: ['step', 'stp'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { imported: false as const };
    }

    const sourcePath = filePaths[0];
    if (!sourcePath) {
      return { imported: false as const };
    }

    const contents = await readFile(sourcePath, 'utf8');
    const imported = await importStepPcbReference(contents);
    return {
      imported: true as const,
      sourcePath,
      projectName: basename(sourcePath).replace(/\.(?:step|stp)$/iu, ''),
      pcb: imported.pcb,
      warnings: imported.warnings,
    };
  });

  ipcMain.handle('project:export', async (_event, project: EnclosureProject, format: ExportFormat) => {
    const generated = generateTwoPieceScrewCase(project);
    let exportedGenerated = generated;
    const extension = extensionForFormat(format);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Export ${format.toUpperCase()}`,
      defaultPath: `${project.name.replace(/[^A-Za-z0-9_-]/g, '_')}.${extension}`,
      filters: [{ name: format.toUpperCase(), extensions: [extension] }],
    });

    if (canceled || !filePath) {
      return { saved: false as const };
    }

    const normalizedFilePath = ensureExtension(filePath, extension);
    if (format === '3mf') {
      const kernelExport = await generatedKernelExport(project, generated);
      exportedGenerated = kernelExport.generated;
      await writeFile(normalizedFilePath, await exportThreeMf(kernelExport.mesh, kernelExport.generated.metadata));
    } else if (format === 'step') {
      await writeFile(normalizedFilePath, await exportTwoPieceScrewCaseStep(project), 'utf8');
    } else {
      const exportResult = await exportTextFormat(project, generated, format);
      exportedGenerated = exportResult.generated;
      await writeFile(normalizedFilePath, exportResult.contents, 'utf8');
    }

    const metadataPath = appendMetadataSuffix(normalizedFilePath);
    await writeFile(metadataPath, exportMakerWorldMetadata(exportedGenerated.metadata), 'utf8');

    return { saved: true as const, filePath: normalizedFilePath, metadataPath };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function ensureExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(`.${extension}`) ? filePath : `${filePath}.${extension}`;
}

function extensionForFormat(format: ExportFormat): string {
  if (format === 'bom') {
    return 'csv';
  }
  return format;
}

function appendMetadataSuffix(filePath: string): string {
  const extensionIndex = filePath.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return `${filePath}.makerworld.json`;
  }
  return `${filePath.slice(0, extensionIndex)}.makerworld.json`;
}

function exportTextFormat(
  project: EnclosureProject,
  generated: GeneratedEnclosure,
  format: Exclude<ExportFormat, '3mf' | 'step'>,
): Promise<{ contents: string; generated: GeneratedEnclosure }> {
  if (format === 'stl') {
    return generatedKernelExport(project, generated).then((kernelExport) => ({
      contents: exportAsciiStl(kernelExport.mesh, project.name),
      generated: kernelExport.generated,
    }));
  }
  if (format === 'obj') {
    return generatedKernelExport(project, generated).then((kernelExport) => ({
      contents: exportObj(kernelExport.mesh, project.name),
      generated: kernelExport.generated,
    }));
  }
  if (format === 'gltf') {
    return generatedKernelExport(project, generated).then((kernelExport) => ({
      contents: exportGltf(kernelExport.mesh, kernelExport.generated.metadata),
      generated: kernelExport.generated,
    }));
  }
  if (format === 'svg') {
    return Promise.resolve({ contents: exportSvgDrawing(project), generated });
  }
  if (format === 'bom') {
    return Promise.resolve({ contents: exportBomCsv(project), generated });
  }
  return Promise.resolve({ contents: exportDxfDrawing(project), generated });
}

async function generatedKernelExport(
  project: EnclosureProject,
  generated: GeneratedEnclosure,
): Promise<{ mesh: TriangleMesh; generated: GeneratedEnclosure }> {
  const mesh = await generateTwoPieceScrewCaseKernelMesh(project);
  const meshTopology = analyzeMeshTopology(mesh);
  return {
    mesh,
    generated: {
      ...generated,
      mesh,
      metadata: {
        ...generated.metadata,
        meshTopology,
        printability: {
          ...generated.metadata.printability,
          overall:
            meshTopology.isClosed && meshTopology.isEdgeManifold
              ? generated.metadata.printability.overall
              : 'blocked',
        },
      },
    },
  };
}

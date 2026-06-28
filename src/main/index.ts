import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log/main';
import { generateTwoPieceScrewCase } from '../shared/cad';
import type { BoardProfile, EnclosureProject, ExportFormat, GeneratedEnclosure } from '../shared/domain';
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
import { importKiCadPcb, importSvgPcb } from '../shared/importers';
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
      preload: join(__dirname, '../preload/index.js'),
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
      log.info('Electron smoke test loaded renderer successfully.');
      setTimeout(() => app.quit(), 250);
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

  ipcMain.handle('project:export', async (_event, project: EnclosureProject, format: ExportFormat) => {
    const generated = generateTwoPieceScrewCase(project);
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
      await writeFile(normalizedFilePath, await exportThreeMf(generated.mesh, generated.metadata));
    } else {
      const contents = exportTextFormat(project, generated, format);
      await writeFile(normalizedFilePath, contents, 'utf8');
    }

    const metadataPath = appendMetadataSuffix(normalizedFilePath);
    await writeFile(metadataPath, exportMakerWorldMetadata(generated.metadata), 'utf8');

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
  return format === 'bom' ? 'csv' : format;
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
  format: Exclude<ExportFormat, '3mf'>,
): string {
  if (format === 'stl') {
    return exportAsciiStl(generated.mesh, project.name);
  }
  if (format === 'obj') {
    return exportObj(generated.mesh, project.name);
  }
  if (format === 'gltf') {
    return exportGltf(generated.mesh, generated.metadata);
  }
  if (format === 'svg') {
    return exportSvgDrawing(project);
  }
  if (format === 'bom') {
    return exportBomCsv(project);
  }
  return exportDxfDrawing(project);
}

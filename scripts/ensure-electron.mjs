import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const electronExecutable = require('electron');
const electronPackageJson = require.resolve('electron/package.json');
const electronPackageDirectory = dirname(electronPackageJson);
const resolvedExecutable = resolve(electronPackageDirectory, electronExecutable);

if (!existsSync(resolvedExecutable)) {
  throw new Error(`Electron runtime was not installed at ${resolvedExecutable}`);
}

console.log(`Electron runtime verified: ${resolvedExecutable}`);

import { spawn, spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const npmCommand = platform() === 'win32' ? 'npm.cmd' : 'npm';
const timeoutMs = Number(process.env.PCB_EG_SMOKE_TIMEOUT_MS ?? 45_000);

await run(npmCommand, ['run', 'build'], { stdio: 'inherit' });

const previewCommand = npmCommand;
const previewArgs = ['run', 'preview'];
const env = {
  ...process.env,
  PCB_EG_DISABLE_GPU: '1',
  PCB_EG_HEADLESS: '1',
  PCB_EG_SMOKE_TEST: '1',
};

const command =
  platform() === 'linux' && !process.env.DISPLAY && hasCommand('xvfb-run') ? 'xvfb-run' : previewCommand;
const args = command === 'xvfb-run' ? ['-a', previewCommand, ...previewArgs] : previewArgs;

await run(command, args, { env, timeoutMs });

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
      env: options.env ?? process.env,
      shell: false,
    });
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Command timed out after ${options.timeoutMs} ms: ${command} ${args.join(' ')}`));
          }, options.timeoutMs);

    child.on('error', (error) => {
      if (timer) {
        clearTimeout(timer);
      }
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed with ${signal ?? `exit code ${code}`}: ${command} ${args.join(' ')}`));
    });
  });
}

function hasCommand(command) {
  const result = spawnSync(platform() === 'win32' ? 'where' : 'command', platform() === 'win32' ? [command] : ['-v', command], {
    stdio: 'ignore',
    shell: platform() !== 'win32',
  });
  return result.status === 0;
}

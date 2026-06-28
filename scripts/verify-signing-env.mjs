const platform = process.argv[2];

if (platform === 'windows') {
  requireEnv('WIN_CSC_LINK');
  requireEnv('WIN_CSC_KEY_PASSWORD');
} else if (platform === 'macos') {
  requireEnv('MAC_CSC_LINK');
  requireEnv('MAC_CSC_KEY_PASSWORD');
  requireEnv('APPLE_ID');
  requireEnv('APPLE_APP_SPECIFIC_PASSWORD');
  requireEnv('APPLE_TEAM_ID');
} else if (platform !== 'linux') {
  throw new Error(`Unknown signing platform: ${platform}`);
}

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required signing environment variable: ${name}`);
  }
}

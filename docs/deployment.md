# Deployment Guide

## Local Commands

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke:electron
```

`npm run smoke:electron` builds the app, starts Electron in a smoke-test mode, verifies
that the production renderer loads, and exits automatically. On Linux it runs headlessly
with Electron headless/GPU-disabled switches; if your local Electron version or display
stack requires an X server, install `xvfb` or run from a desktop session.

## Platform Packages

Run package commands on the target operating system:

```bash
npm run package:linux
npm run package:win
npm run package:mac
```

Outputs are written to `release/`.

- Linux: AppImage
- Windows: NSIS installer
- macOS: DMG

These default packages are unsigned. Public distribution should configure code signing
before release. Windows packages require a Windows runner or a Linux environment with
Wine installed. macOS packages require a macOS runner because Electron Builder uses Apple
tooling such as `sips`.

If `electron-vite dev` reports `Error: Electron uninstall`, run `npm ci` or
`npm run postinstall` to force verification/download of the Electron runtime before
starting the app.

## GitHub Release Workflow

`.github/workflows/release.yml` builds packages on native Linux, Windows, and macOS
runners. It can be started manually from GitHub Actions. Pushing a tag such as `v0.1.0`
also packages all platforms and publishes a GitHub release with the generated artifacts.

## Signing Notes

Windows installers should be Authenticode-signed. macOS builds should be signed with an
Apple Developer ID certificate and notarized. Manual `workflow_dispatch` runs can still
produce unsigned test artifacts. Tagged releases require signing secrets for Windows and
macOS before packaging starts.

Required GitHub Actions secrets:

- `WIN_CSC_LINK`: base64-encoded Windows signing certificate or certificate URL
- `WIN_CSC_KEY_PASSWORD`: Windows certificate password
- `MAC_CSC_LINK`: base64-encoded Apple Developer ID certificate or certificate URL
- `MAC_CSC_KEY_PASSWORD`: macOS certificate password
- `APPLE_ID`: Apple developer account email used for notarization
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for notarization
- `APPLE_TEAM_ID`: Apple Developer Team ID

The release workflow passes these values through Electron Builder's standard
`CSC_*`/Apple notarization environment variables and fails tagged Windows/macOS release
jobs early when the required secrets are missing.

## Docker Development

Build and run a Linux development container:

```bash
docker compose up --build
```

The compose file mounts the workspace and X11 socket for Electron GUI development on
Linux hosts. On non-Linux hosts, prefer native `npm run dev` or a VM with display
forwarding configured.

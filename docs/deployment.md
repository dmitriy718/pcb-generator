# Deployment Guide

## Local Commands

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

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
before release.

## GitHub Release Workflow

`.github/workflows/release.yml` builds packages on native Linux, Windows, and macOS
runners. It can be started manually from GitHub Actions. Pushing a tag such as `v0.1.0`
also packages all platforms and publishes a GitHub release with the generated artifacts.

## Signing Notes

Windows installers should be Authenticode-signed. macOS builds should be signed with an
Apple Developer ID certificate and notarized. The current workflow sets
`CSC_IDENTITY_AUTO_DISCOVERY=false` so CI can produce unsigned test artifacts without
failing when certificates are unavailable.

## Docker Development

Build and run a Linux development container:

```bash
docker compose up --build
```

The compose file mounts the workspace and X11 socket for Electron GUI development on
Linux hosts. On non-Linux hosts, prefer native `npm run dev` or a VM with display
forwarding configured.

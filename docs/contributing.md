# Contributing

## Standards

- Keep TypeScript strict.
- Add tests with every behavioral change.
- Do not add mock-only production logic.
- Do not claim unsupported importers, exporters, or templates in the UI.
- Keep generated geometry derived from structured parameters.
- Return actionable validation errors for invalid configurations.
- Geometry-affecting editor features must change exported meshes, not only preview annotations.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Geometry Changes

Geometry changes must include:

- Parameter validation coverage.
- Mesh or CAD validation coverage.
- Export regression coverage when file output changes.
- Documentation updates when user-visible behavior changes.

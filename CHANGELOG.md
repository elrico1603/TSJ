# Changelog

All notable changes to the **TS Kanban Management Hub** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to versioning with build numbers: `vMajor.Minor.Patch.Build` (e.g. `v1.0.0.001`).


## [v1.0.0.002] - 2026-07-28

### Added
- System stability improvements and automated version release logging.

### Changed
- Synchronized application versioning across client components.

### Fixed
- Automated build metadata tracking and environment sync.

### Files Modified
- `src/version.ts`, `package.json`, `CHANGELOG.md`

## [v1.0.0.001] - 2026-07-28

### Added
- Centralized Application Version Management System in `src/version.ts`.
- Integrated System Version & About section inside Settings Modal and lateral navigation sidebar.
- Automated release creation tool (`scripts/release.js` / `npm run release`).
- Automatic Git commit message generator and Git tag formatting (`vMajor.Minor.Patch.Build`).

### Changed
- Standardized single source of truth for version metadata across all application views.
- Updated Settings Modal to feature comprehensive build information and version details.

### Fixed
- Preserved precise card dimensions and layout math across template renders.

### Files Modified
- `src/version.ts`
- `src/components/SettingsModal.tsx`
- `src/App.tsx`
- `package.json`
- `CHANGELOG.md`
- `scripts/release.js`

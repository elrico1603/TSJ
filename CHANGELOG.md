# Changelog

All notable changes to the **TS Kanban Management Hub** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to versioning with build numbers: `vMajor.Minor.Patch.Build` (e.g. `v1.0.0.001`).

## [v1.0.0.022] - 2026-08-24

### Added
- **Employee Disciplinary & Warning System**:
  - Direct "Log Warning / Disciplinary Action" modal inside Work Analytics.
  - Granular severity levels (Verbal Warning, Written Warning, Final Written Warning, Suspension / Hearing).
  - Offense categorization (Attendance, Safety Violation, Performance, Misconduct, Insubordination, Negligence, Damage to Property, Other).
  - Expiry period tracking (3, 6, 12 Months, Permanent) and document attachment preview (Photos / PDFs of physical forms).
- **Customizable Role-Based PPE Gear Checklist & Issuance**:
  - Role PPE Template Builder allowing customizable safety equipment packages (Artisan, Carpenter, Machine Operator, Supervisor, etc.).
  - Interactive gear issuance checklist with size, serial number, condition status, and employee digital PIN authentication.
  - Dedicated printable A4 PPE Compliance Sign-off Certificate with Timbersmith Joinery letterhead, OHS legal undertaking, and dual signature blocks.
- **Report Generation Updates**:
  - Automatically integrated Disciplinary & Warning Records and PPE Issuance Compliance tables into the main Labor Summary PDF export.
- **Central Version Synchronization**:
  - Bumped version to `v1.0.0.022`, synchronized UI badges and version history logs.

### Files Modified
- `src/version.ts`, `src/types/employee.ts`, `src/types.ts`, `src/services/disciplinaryAndPPEService.ts`, `src/components/DisciplinaryActionModal.tsx`, `src/components/PPEIssuanceModal.tsx`, `src/components/PPESignOffCertificate.tsx`, `src/components/WorkAnalytics.tsx`, `src/components/ReportPrintTemplate.tsx`, `src/App.tsx`, `CHANGELOG.md`

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

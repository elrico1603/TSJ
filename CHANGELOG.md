# Changelog

All notable changes to the **TS Kanban Management Hub** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to versioning with build numbers: `vMajor.Minor.Patch.Build` (e.g. `v1.0.0.001`).

## [v1.0.0.029] - 2026-08-26

### Added
- **Archive Dispatch Workflow for Completed Shipments**:
  - Added `isArchived`, `archivedAt`, and `archivedBy` fields to the `MobileDispatchDoc` and `DispatchRecord` data contracts.
  - Implemented `archiveDispatch` and `unarchiveDispatch` in `src/services/mobileDispatchService.ts` to update Firestore dispatches collection and local storage cache while appending audit trail history entries.
  - Added "Archive Dispatch" action button on completed receiving cards (`Delivered / Completed`, `Delivered / Received`, `Received`).
  - Added a dedicated archive confirmation modal detailing dispatch number, destination branch, and project information.
  - Added an "Archived" status filter chip with real-time record count to partition active vs archived shipments cleanly.
  - Provided a "Restore to Active" capability for auditing and unarchiving shipments if needed.

### Files Modified
- `src/services/mobileDispatchService.ts`, `src/components/DispatchesView.tsx`, `src/components/DispatchDetails.tsx`, `src/services/dispatchAdapter.ts`, `src/version.ts`, `src/services/companyService.ts`, `CHANGELOG.md`

## [v1.0.0.028] - 2026-08-25

### Fixed
- **Defaulted Dispatches Landing Tab to 'incoming' and Fixed Missing Timestamp Sorting Fallbacks**:
  - Updated `src/components/DispatchesView.tsx` so the active tab consistently defaults to `'incoming'` (Active / Incoming dispatches list) for all users upon opening the module.
  - Enhanced `src/services/mobileDispatchService.ts` to query the Firestore `'dispatches'` collection without strict `.orderBy('createdAt', 'desc')` query constraints that drop documents missing an indexed `createdAt` field, performing robust in-memory date sorting instead.
  - Added seamless legacy cache fallback and merging (`tsj_mobile_dispatches_cache_v1` and `tsj_dispatches_v1`) so existing and offline dispatches remain immediately visible.

### Files Modified
- `src/components/DispatchesView.tsx`, `src/services/mobileDispatchService.ts`, `src/version.ts`, `src/services/companyService.ts`, `CHANGELOG.md`

## [v1.0.0.027] - 2026-08-25

### Fixed
- **Fixed Viewport Hardware Auto-Detection and Cleared Legacy Phone localStorage Overrides on Desktop Screens**:
  - Enforced strict physical screen-width auto-detection in `src/App.tsx` (`>= 1024px` defaults to `'desktop'`, `768px - 1023px` to `'tablet'`, `< 768px` to `'phone'`).
  - Cleared/overwrote invalid `'phone'` layout overrides in `localStorage` when loading on desktop viewports (`window.innerWidth >= 1024`).
  - Added immediate mount-time and next-animation-frame re-evaluation of viewport dimensions to resolve sandboxed iframe/container initialization timing.

### Files Modified
- `src/App.tsx`, `src/version.ts`, `src/services/companyService.ts`, `CHANGELOG.md`

## [v1.0.0.026] - 2026-08-24

### Fixed
- **Fixed Dynamic Dispatch Sub-Module Gating and Dynamic Navigation Permission Filters**:
  - Expanded `canViewDispatch` in `DispatchesView.tsx` to grant access if any sub-module under `DISPATCH & RECEIVING` (`Dispatch Creation`, `Receiving Inspection`, `Discrepancy Management`, `Waybills & Delivery Notes`) has `View` enabled for the active user's role.
  - Implemented smart default tab selection: automatically defaults to `'create'` if the user has `Dispatch Creation (View)`, or auto-defaults directly to `'incoming'` if the user only has `Receiving Inspection` or `Discrepancy Management` permissions.
  - Enforced dynamic permission checks for the Clocking Terminal tab on both Desktop lateral sidebar and Mobile bottom navigation bar using `permissionService.hasPermission(currentUser, 'Clocking', 'View')`.

### Files Modified
- `src/components/DispatchesView.tsx`, `src/App.tsx`, `src/version.ts`, `src/services/companyService.ts`, `CHANGELOG.md`

## [v1.0.0.025] - 2026-08-24

### Fixed
- **Fixed Artisan Terminal Profile Visibility and Fallback Avatars**:
  - Removed strict photo URL gate (`if (!photoUrl) continue;`) from `ClockingTerminal.tsx`, enabling all active non-archived artisans to appear on the attendance terminal.
  - Seamlessly enabled initial letter avatar fallback (`PhotoAvatar`) for artisans without pre-uploaded portrait photographs.
  - Preserved realtime Firestore stream integrity and Cloud Storage offloading for heavy attachments.

### Files Modified
- `src/components/ClockingTerminal.tsx`, `src/version.ts`, `src/services/companyService.ts`, `CHANGELOG.md`

## [v1.0.0.023] - 2026-08-24

### Fixed
- **Fixed PPE Printable Certificate CSS @media print engine & multi-page support**:
  - Resolved Chrome print preview blank page defect by isolating `#ppe-print-certificate`, `.ppe-certificate-print` visibility and overriding parent modal wrappers.
  - Reset layout heights and overflow constraints during print execution (`overflow: visible !important; height: auto !important; position: static !important`).
  - Configured `@page { size: A4 portrait; margin: 12mm 15mm; }` for accurate A4 compliance print margins.
  - Added robust page-break prevention (`page-break-inside: avoid; break-inside: avoid;`) on Legal Undertaking boxes, Dual Signature blocks, table rows, and document header/metadata sections.
  - Allowed long gear schedules and table sections to flow cleanly across multiple pages (`page-break-after: auto`).

### Files Modified
- `src/index.css`, `src/components/PPESignOffCertificate.tsx`, `src/version.ts`, `src/services/companyService.ts`, `CHANGELOG.md`

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

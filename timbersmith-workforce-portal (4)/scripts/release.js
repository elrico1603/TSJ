import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const versionFilePath = path.join(rootDir, 'src', 'version.ts');
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

// 1. Read current version from src/version.ts
const versionContent = fs.readFileSync(versionFilePath, 'utf8');

const majorMatch = versionContent.match(/major:\s*(\d+)/);
const minorMatch = versionContent.match(/minor:\s*(\d+)/);
const patchMatch = versionContent.match(/patch:\s*(\d+)/);
const buildMatch = versionContent.match(/buildNumber:\s*(\d+)/);

if (!majorMatch || !minorMatch || !patchMatch || !buildMatch) {
  console.error('❌ Error: Could not parse src/version.ts');
  process.exit(1);
}

let major = parseInt(majorMatch[1], 10);
let minor = parseInt(minorMatch[1], 10);
let patch = parseInt(patchMatch[1], 10);
let buildNumber = parseInt(buildMatch[1], 10);

// Command line arguments parsing (--patch, --minor, --major)
const args = process.argv.slice(2);
let bumpType = 'build';

args.forEach(arg => {
  if (arg === '--patch') bumpType = 'patch';
  if (arg === '--minor') bumpType = 'minor';
  if (arg === '--major') bumpType = 'major';
});

if (bumpType === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === 'minor') {
  minor += 1;
  patch = 0;
} else if (bumpType === 'patch') {
  patch += 1;
}

// Always increment build number for a stable release
buildNumber += 1;

const today = new Date().toISOString().split('T')[0];
const paddedBuild = String(buildNumber).padStart(3, '0');
const versionTag = `v${major}.${minor}.${patch}.${paddedBuild}`;

// 2. Update src/version.ts
let newVersionContent = versionContent
  .replace(/major:\s*\d+/, `major: ${major}`)
  .replace(/minor:\s*\d+/, `minor: ${minor}`)
  .replace(/patch:\s*\d+/, `patch: ${patch}`)
  .replace(/buildNumber:\s*\d+/, `buildNumber: ${buildNumber}`)
  .replace(/buildDate:\s*['"][^'"]+['"]/, `buildDate: '${today}'`);

fs.writeFileSync(versionFilePath, newVersionContent, 'utf8');

// 3. Update package.json version
const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
pkgData.version = `${major}.${minor}.${patch}`;
fs.writeFileSync(packageJsonPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');

// 4. Append to CHANGELOG.md
let changelogContent = '';
if (fs.existsSync(changelogPath)) {
  changelogContent = fs.readFileSync(changelogPath, 'utf8');
} else {
  changelogContent = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n`;
}

const addedNotes = process.env.RELEASE_ADDED || '- System stability improvements and automated version release logging.';
const changedNotes = process.env.RELEASE_CHANGED || '- Synchronized application versioning across client components.';
const fixedNotes = process.env.RELEASE_FIXED || '- Automated build metadata tracking and environment sync.';
const modifiedFiles = process.env.RELEASE_FILES || '- `src/version.ts`, `package.json`, `CHANGELOG.md`';

const newChangelogSection = `\n## [${versionTag}] - ${today}\n\n### Added\n${addedNotes}\n\n### Changed\n${changedNotes}\n\n### Fixed\n${fixedNotes}\n\n### Files Modified\n${modifiedFiles}\n`;

if (changelogContent.includes('## [')) {
  const firstHeaderIndex = changelogContent.indexOf('## [');
  changelogContent = changelogContent.slice(0, firstHeaderIndex) + newChangelogSection + '\n' + changelogContent.slice(firstHeaderIndex);
} else {
  changelogContent += newChangelogSection;
}

fs.writeFileSync(changelogPath, changelogContent, 'utf8');

console.log('==================================================');
console.log(`🚀 STABLE RELEASE CREATED: ${versionTag}`);
console.log(`📅 Build Date: ${today}`);
console.log(`🔢 Build Number: ${buildNumber}`);
console.log('==================================================');
console.log('Generated Git Commands:');
console.log(`  git add .`);
console.log(`  git commit -m "release: bump version to ${versionTag}"`);
console.log(`  git tag -a ${versionTag} -m "Release ${versionTag}"`);
console.log('==================================================');

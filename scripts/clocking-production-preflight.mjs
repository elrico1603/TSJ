/** Read-only source inventory. Never authorizes a release or contacts Firebase. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const evidence = (path, needle) => {
  const line = read(path).split(/\r?\n/).findIndex(text => text.includes(needle));
  return { path, line: line < 0 ? null : line + 1, observation: line < 0 ? 'RECHECK_REQUIRED' : 'FOUND' };
};

try {
  const report = {
    releaseDecision: 'BLOCKED_REQUIRES_REVIEW',
    scope: 'Source inventory only; absence of a pattern never proves production readiness.',
    head: git('rev-parse', 'HEAD'),
    branch: git('branch', '--show-current'),
    comparisonMain: git('rev-parse', 'origin/main'),
    dirty: Boolean(git('status', '--porcelain')),
    changedFilesFromMain: git('diff', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean),
    findings: [
      { id: 'legacy-clock-write', evidence: evidence('src/App.tsx', 'transaction.update(employeeRef, updateData)') },
      { id: 'exact-existing-pin', evidence: evidence('src/App.tsx', 'const isValid = Boolean(expectedCode && String(pinStr) === String(expectedCode))') },
      { id: 'local-only-api', evidence: evidence('server.ts', '!process.env.K_SERVICE && !process.env.NETLIFY') },
      { id: 'test-only-processor', evidence: evidence('server/clocking/clockEventProcessor.ts', 'Clock event processor is restricted to test namespaces.') },
      { id: 'relative-api-transport', evidence: evidence('src/services/clockTestApiTransport.ts', "request('/api/clocking/test-replay'") },
      { id: 'spa-fallback', evidence: evidence('netlify.toml', 'to = "/index.html"') },
      { id: 'fixed-live-namespace', evidence: evidence('src/firebase.ts', "APP_ID_PATH = 'timbersmith-terminal-v1'") },
      { id: 'candidate-registered-route', evidence: evidence('server/clocking/productionClockRoutes.ts', "router.post('/replay'") },
      { id: 'candidate-default-off', evidence: evidence('server/clocking/productionClockRoutes.ts', "process.env.TSJ_ENABLE_PRODUCTION_CLOCKING !== 'true'") },
      { id: 'candidate-server-proof', evidence: evidence('server/clocking/productionClockProcessor.ts', '!verifyClockSignature(event, credential)') },
      { id: 'candidate-strict-journal', evidence: evidence('src/services/productionClockStore.ts', "{durability:'strict'}") }
    ],
    externalEvidence: {
      deployedCommitAndNetlifyDeployId: 'UNVERIFIED',
      cloudRunRevisionProjectServiceAccountAndTraffic: 'OBSERVED_00015_B5B_COMMIT_5223DBB_2026_11_05_SEE_SAVED_EVIDENCE',
      defaultDatabasePublishedRules: 'OBSERVED_PUBLIC_READ_WRITE_2026_11_05_SEE_SAVED_EVIDENCE',
      namedRegistryDatabaseRulesBillingAndIAM: 'REGISTRY_CREATED_DENY_ALL_VERIFIED_2026_11_05_RUNTIME_IAM_REVIEW_PENDING',
      backupRestoreAndTabletRecovery: 'UNVERIFIED',
      protectedDeviceEndToEnd: 'UNVERIFIED',
      explicitClockingAndPinUnlock: 'AUTHORIZED_IN_CHAT_2026_11_05_IMPLEMENTATION_ONLY',
      mergeAndDeploymentApproval: 'REQUIRED'
    }
  };
  console.log(JSON.stringify(report, null, 2));
  // Deliberately nonzero: a source inventory cannot certify a live release.
  process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ releaseDecision: 'BLOCKED_INVENTORY_FAILED', error: error.message }));
  process.exitCode = 2;
}

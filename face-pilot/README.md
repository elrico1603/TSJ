# TS Hub Face Verification — independent experimental pilot

This folder is deliberately separate from the running TS Hub application. It has no Firebase config, no attendance API, no employee IDs, no production credentials and no access to payroll. The existing PIN and User Creation flows remain untouched. The pilot is one-to-one verification against a voluntarily enrolled test profile, not a search across employees.

## Local build and phone test

From the repository root (Node installed):

```powershell
npm install --prefix face-pilot --ignore-scripts
npm run build --prefix face-pilot
```

The output is `face-pilot/dist`. Open https://app.netlify.com/drop and create a **separate** temporary test site by uploading only this folder. Do not deploy to the existing TS Hub site. Check your Netlify plan's allowance first. Alternatively use an HTTPS static host. Camera access is unavailable on ordinary HTTP LAN IP addresses.

Open the new HTTPS URL on the phone. Allow the camera. Choose Start camera & load model, Enroll my face, then Verify my face. Follow the three on-screen prompts: look straight, turn slightly to either side, look straight again. Ordinary blinking is fine. Each step retries automatically after 20 seconds, or press Retry current step. Completed stages stay intact; only genuine identity failures, camera cancellation, page exit or the five-minute security session limit require a new scan. Keep the page open; the enrolled template exists in memory only.

## Acceptance tests on the actual device

1. Enroll the consenting tester under good lighting. Verify the same face at least three times.
2. A different consenting adult attempts verification without enrolling again. Expect refusal.
3. Present a printed or phone-screen photograph of the enrolled tester. Expect refusal.
4. Play a recorded video of the enrolled tester responding to challenges. Expect refusal. A successful attack is a deployment blocker.
5. Two faces in the frame, blocked camera or missing permission must not approve.
6. While the page is already loaded, switch off mobile data and Wi-Fi, and try verification again. The model and profile are in memory, so continued processing is intended; reload while offline is not implemented.

Record scores and pass/refusal results; no face images or templates are needed for reporting. Clear the test profile when finished.

## Limitations and commercial release gate

Human 3.3.6 runs a face embedding model, anti-spoof and liveness models locally. The library is MIT; model weights retain source-specific terms, and model licensing must be reviewed before commercial deployment. See https://github.com/vladmandic/human/wiki/Models and https://github.com/vladmandic/human/wiki/Embedding. The model may internally calculate attributes alongside its descriptor; the pilot does not display or persist them.

The thresholds in checks.js are experimental, not independently calibrated or certified. RGB-only cameras can be fooled by sophisticated attacks. The pilot uses fresh frames, one head-turn-and-return challenge (simplified from the earlier blink/two-turn challenge) and matching across the challenge, but cannot guarantee protection against replay, deepfakes or a compromised browser. Its result is not an authorization token.

Production requires approval to unlock the Clocking integration, supervised enrollment, a protected template store and secure device/backend binding; a user must not be able to replace the enrolled template or bypass verification using the legacy PIN route. The previous offline Clocking branch remains separate. POPIA review, retention controls and a supervised exception process are required before employee biometric processing.

No paid facial recognition API, Firestore database or new cloud service is created by this branch.

# GitHub Actions Secrets

### `FIREBASE_SERVICE_ACCOUNT`

What it is:

- A JSON service account key for the Google Cloud / Firebase project `wmb-table`.

What it does:

- Authenticates `firebase-tools` in CI
- Deploys Firebase Hosting
- Uploads release files to `gs://wmb-table.appspot.com/releases/`

Where to get it:

1. Open Firebase Console for project `wmb-table`
2. Go to `Project settings` -> `Service accounts`
3. Generate a new private key
4. Download the JSON key file
5. Copy the full JSON content into the GitHub secret `FIREBASE_SERVICE_ACCOUNT`

Alternative path:

- You can also create or manage the same service account from Google Cloud Console under
  `IAM & Admin` -> `Service Accounts`

Recommended minimum access:

- Firebase Hosting Admin or equivalent Firebase deploy access
- Storage Object Admin on the project bucket

### `GOOGLE_DRIVE_CREDENTIALS`

What it is:

- JSON credentials used by the desktop app for Google Drive integration during release builds.

What it does:

- During the release workflow, if this secret exists, CI writes it to:
  `resources/credentials/google/google-drive-credentials.json`
- That file is then bundled into the Electron app

Where to get it:

1. Open Google Cloud Console
2. Go to `APIs & Services` -> `Credentials`
3. Create the credential required by your Google Drive integration
4. Copy the JSON content into the GitHub secret `GOOGLE_DRIVE_CREDENTIALS`

Notes:

- The release workflow already treats this as optional
- If your app build does not need bundled Google Drive credentials, leave it unset

### `CSC_LINK` and `CSC_KEY_PASSWORD`

What they are:

- `CSC_LINK` — a base64-encoded `.p12` code-signing certificate for macOS
- `CSC_KEY_PASSWORD` — the password protecting that `.p12`

What they do:

- electron-builder imports the certificate into a temporary keychain and signs the whole
  macOS bundle with it
- Without them, [scripts/afterPack.cjs](afterPack.cjs) falls back to ad-hoc signing
  (`codesign --sign -`) and **macOS auto-update cannot work**

Why a free self-signed certificate is enough:

- Squirrel.Mac verifies an update with `SecStaticCodeCheckValidityWithErrors` against the
  running app's _designated requirement_. It does not check the trust chain, so the
  certificate does not have to be issued by Apple.
- A certificate-backed signature yields a requirement pinned to the certificate, which stays
  stable across releases. An ad-hoc signature has no certificate, so the requirement pins the
  `cdhash` instead — that changes every build, and every update is rejected.
- The only thing a paid Developer ID buys here is Gatekeeper/notarization, i.e. installing
  without the manual right-click -> Open. Updates themselves do not need it.

How to create one (once, any OS — a Mac is not needed):

```sh
./scripts/generate-mac-signing-cert.sh
```

It writes to `~/wmb-table-signing/` and prints which file goes into which secret. It refuses
to run if that directory already exists, so it cannot silently replace a certificate in use.

Notes:

- **Keep this certificate.** Every release must be signed with the same one, or already
  installed apps can no longer update and users must reinstall manually. Back up
  `~/wmb-table-signing/` somewhere safe.
- The certificate must carry the `codeSigning` extended key usage. Without it macOS reports
  the identity as `(Missing required extension)` and electron-builder discards it.
- The `.p12` must use legacy PBE (`openssl pkcs12 -export -legacy`). OpenSSL 3 otherwise
  defaults to AES-256-CBC, which `security import` cannot read.
- electron-builder falls back to any valid non-Apple identity in the keychain, so no
  `mac.identity` entry is needed in `package.json`.
- Both secrets are optional; leaving them unset keeps the current ad-hoc behaviour.

Verifying the first signed build:

- The build log should show electron-builder signing with `WMB Table` rather than skipping.
- `security find-identity -v -p codesigning` must list the identity — that is the list
  electron-builder reads. If it is missing, the temporary keychain needs the certificate
  trusted first: `security add-trusted-cert -r trustRoot -k <keychain> signing.cer`.
- The real test is publishing two signed releases and confirming the first updates to the
  second. An unsigned or differently-signed build cannot update.

### `MAIN_VITE_GITHUB_TOKEN`

What it is:

- A GitHub token exposed to the Electron main-process build as `MAIN_VITE_GITHUB_TOKEN`.

What it does:

- Used by app code in [src/main/lib/github.ts](/home/paradoxe/Documents/projects/pngwasi/wmb-table/src/main/lib/github.ts)
- Lets the packaged app access GitHub APIs where unauthenticated access would fail or be rate-limited

Where to get it:

1. Create a GitHub personal access token or GitHub App token
2. Give it only the repository/API scopes your app actually needs
3. Save it in GitHub Actions secrets as `MAIN_VITE_GITHUB_TOKEN`

Notes:

- This is separate from the built-in workflow `GITHUB_TOKEN`
- Only add it if the desktop app still needs authenticated GitHub API access at runtime

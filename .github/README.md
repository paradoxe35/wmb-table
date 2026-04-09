# GitHub Actions Secrets

### `FIREBASE_SERVICE_ACCOUNT`

What it is:

- A JSON service account key for the Google Cloud / Firebase project `wmb-table`.

What it does:

- Authenticates `firebase-tools` in CI
- Deploys Firebase Hosting
- Deploys Firebase Storage rules
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
- Firebase Rules Admin or equivalent rules deploy access
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

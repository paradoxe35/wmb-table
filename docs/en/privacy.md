# Privacy Policy

_Last updated: April 13, 2026_

This Privacy Policy explains how Wmb Table handles information when you use:

- the Wmb Table desktop application
- the Wmb Table documentation website

This page was written from the features currently implemented in the application and documentation codebase.

## Plain-language summary

Wmb Table stores most user data locally on your device.

Depending on the features you enable, the app may also communicate with third-party services to:

- check for and download application updates
- download language packs, local AI models, or local TTS models
- stream or cache certain remote audio files
- send requests to an AI provider you choose
- send text to an online text-to-speech provider you choose
- back up and sync certain data through Google Drive if you enable that feature
- send error reports to Sentry

The documentation website also currently uses:

- a language-preference cookie
- a contact form submitted through Formbold
- a download panel that fetches release metadata

## 1. Information processed locally in the app

Wmb Table is designed as a desktop app. Based on the current code, the following categories of information may be stored locally on your device:

- your notes and note references
- your subjects and subject items
- your highlights and highlight comments
- your imported personal documents, including extracted text
- your reading history
- your reading positions and open tabs
- your language and interface preferences
- your audio, TTS, and AI settings
- your AI conversations and messages
- your search suggestions
- your last-played audio information and certain cached audio files
- local AI models, local TTS models, search indexes, and downloaded language packs
- Google tokens used for sync, if you enable Google Drive sync
- API keys and remote-provider settings that you configure for AI or TTS

In the current implementation, this information is primarily stored in local files and databases under an app data directory similar to `~/.wmb-table`.

## 2. Information sent to third parties when you enable certain features

### 2.1 Error reporting

The app currently initializes Sentry in both the main process and the renderer.

That means technical error, crash, or exception information may be sent to Sentry, such as:

- app and version information
- technical error context
- device, operating-system, or session details needed to diagnose problems

We do not use this for advertising. It is used to diagnose and fix issues.

### 2.2 Application updates

When the app checks for updates or downloads a new version, it contacts the configured GitHub release sources for Wmb Table.

This can involve standard network request data such as:

- IP address
- request metadata
- the app version requesting the update

### 2.3 Language packs, models, and downloaded files

The app can download or update:

- language packs
- local AI models
- local TTS models
- certain audio files used for playback

These downloads involve connections to the relevant hosts, which may include GitHub, Hugging Face, Wasabi, or other sources configured by the app.

### 2.4 AI assistant

The AI assistant stays disabled until you turn it on in settings.

If you choose a remote provider such as OpenAI, OpenRouter, Gemini, Claude, or a compatible custom provider, Wmb Table may send the selected provider:

- your message
- recent conversation history
- summarized conversation memory
- system instructions needed for the assistant to operate
- tool results used during the response

Depending on what you ask, those tool results can include information retrieved from inside the app, such as:

- sermon content
- Bible references
- installed language information
- notes
- subjects
- personal documents

If you choose `Local` mode, AI processing runs on your device with a locally downloaded model.

### 2.5 Audio reading and text-to-speech

Wmb Table supports both local voices and remote text-to-speech services.

If you use a remote provider such as Edge TTS, Cartesia, ElevenLabs, or OpenAI TTS, text may be sent to that provider to generate audio.

If you use a local voice option, such as system voices or Sherpa-ONNX TTS, synthesis stays on your device subject to normal platform behavior.

Some voice-cloning features may also send the audio samples you provide to the relevant provider.

### 2.6 Google Drive backup and sync

Google Drive backup and sync are optional.

If you enable this feature, Wmb Table redirects you to your browser for Google authentication and currently requests access to:

- your basic Google profile
- your Google email address
- the Google Drive `appDataFolder`

When the feature is active, Wmb Table may store or synchronize database snapshots and change-log files in Google Drive containing certain categories of user data, including:

- notes
- note references
- Bible note references
- subjects
- subject items
- personal documents
- search suggestions
- highlights
- AI conversations
- AI messages

The app also stores minimal local access information such as your name, email address, backup status, and the Google token needed to reconnect.

Important: in the current code, signing out removes local tokens and local sync state, but this page does not guarantee that every copy already stored in your Google Drive is automatically deleted.

## 3. What the documentation site processes

The Wmb Table documentation site processes much less information than the app itself.

### 3.1 Language preference

The site currently stores a language-preference cookie to remember whether you prefer the French, English, or Spanish version.

That cookie is used only to display the preferred language.

### 3.2 Contact form

If you use the site contact form, the information you enter is sent to Formbold:

- name
- email
- subject
- message

Do not submit sensitive information through the contact form if you do not want it handled by a third-party form processor.

### 3.3 Download panel

The documentation home page can fetch a release manifest so it can suggest downloads for your device.

That component may process technical browser data such as:

- user agent
- estimated platform
- estimated architecture
- page locale

## 4. Why information is used

We process the relevant information depending on the feature involved:

- to provide the app’s core functionality
- to perform the features you choose to enable
- to secure, maintain, and improve the software
- to respond to messages sent through the contact form

## 5. How information is shared

We do not sell personal information.

Information may still be shared with technical providers when needed to operate the features you use, including:

- Sentry for error reporting
- GitHub for updates and some downloads
- Google for authentication and Drive sync
- Formbold for the website contact form
- the AI provider you choose
- the remote TTS provider you choose
- file hosts used for languages, models, or audio

Each third-party service also applies its own terms and privacy practices.

## 6. Data retention

Local app data generally remains on your device until:

- you delete it in the app
- you remove the local files
- you uninstall the app and remove its local data

Information sent to third-party services may be retained under those services’ own rules.

Data synchronized to Google Drive may remain in your Google Drive space until it is deleted from that space.

## 7. Security

We try to limit data exposure by keeping core functionality local where practical.

However:

- no system is perfectly secure
- security also depends on your device, Google account, API keys, and the third-party services you choose
- if you enable remote providers, data sent to them leaves your device

You are responsible for protecting:

- your device
- your third-party accounts
- your API keys
- your files and backups

## 8. Your choices

You can limit external processing in several ways:

- do not enable Google Drive sync
- do not enable the AI assistant
- choose local AI mode instead of a remote provider
- choose a local TTS voice instead of a remote provider
- do not use the website contact form
- delete specific local content from the app

## 9. Children

Wmb Table is not presented as a service specifically directed to children.

If a minor uses the app, the responsible adult should make sure sensitive information is not shared through remote features or the website contact form.

## 10. Changes to this policy

We may update this policy to reflect changes to Wmb Table, the documentation site, or the third-party services involved.

The date at the top of this page shows the latest update date.

## 11. Contact

For privacy or data questions:

- Email: [paradoxngwasi@gmail.com](mailto:paradoxngwasi@gmail.com)
- Contact page: [Contact Us](/en/contact)

## See also

- [Terms of Service](/en/terms)
- [Backup and Sync](/en/guide/backup-and-sync)
- [Assistant Settings](/en/guide/settings-assistant)
- [Audio Reading and Voices](/en/guide/audio-and-tts)

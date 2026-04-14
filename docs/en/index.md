---
layout: home

hero:
    name: Wmb Table
    text: Read and prepare your sermons more easily.
    tagline: A clear workspace for reading sermons, using the Bible, taking notes, building subjects, and keeping your documents together.
    image:
        src: /icon.png
        alt: Wmb Table
    actions:
        - theme: brand
          text: Download
          link: '#download'
        - theme: alt
          text: View Guides
          link: /en/guide/interface-overview

features:
    - title: Sermons in tabs
      details: Open multiple sermons side by side in tabs, with paragraph navigation and text highlighting.
      link: /en/guide/sermons
    - title: Built-in Bible
      details: Browse multiple Bible versions directly in the app, with search by book, chapter, and verse.
      link: /en/guide/bible
    - title: Notes and subjects
      details: Take notes, organize passages by subject, and add references from sermons or the Bible.
      link: /en/guide/notes
    - title: Full-text search
      details: Search inside sermon content, the Bible, your notes, and your subjects in seconds.
      link: /en/guide/search
    - title: Audio reading
      details: Listen to sermons with multiple voices available, including local voices that work offline.
      link: /en/guide/audio-and-tts
    - title: AI assistant
      details: Ask questions about sermons and get answers with clickable references to the exact passages.
      link: /en/guide/ai-chat
    - title: Highlights and annotations
      details: Highlight important passages with colors, add comments, and find them easily later.
      link: /en/guide/highlights
    - title: Backup and sync
      details: Save your data to Google Drive and synchronize between your devices.
      link: /en/guide/backup-and-sync
    - title: Multilingual
      details: Available in French, English, Spanish, and more languages, with the ability to switch at any time.
      link: /en/guide/languages
---

<HomeFeatureCards
  :items="[
    {
      icon: '📖',
      title: 'Made for ministry',
      text: 'This documentation explains each feature in simple language, without technical wording.'
    },
    {
      icon: '🗂',
      title: 'Everything grouped clearly',
      text: 'Reading, Bible, notes, subjects, audio, and backup are organized into short and practical guides.'
    },
    {
      icon: '🌍',
      title: 'French, English, Spanish',
      text: 'The documentation follows the app languages so each user can feel at home.'
    }
  ]"
/>

<HomeQuickSteps
  title="Start in a few minutes"
  :items="[
    {
      title: 'Choose your language',
      text: 'At first launch, download the language you want to use. You can add more later.'
    },
    {
      title: 'Open a sermon',
      text: 'Use the right side panel to choose a sermon, a Bible chapter, or one of your own documents.'
    },
    {
      title: 'Prepare your message',
      text: 'Add notes, gather passages into subjects, and use audio reading if it helps you.'
    }
  ]"
/>

<ReleaseDownloadPanel
  :labels="{
    title: 'Download Wmb Table',
    loading: 'Looking for the latest version...',
    downloading: 'Download',
    installLink: 'Installation guide',
    fallback: 'Downloads are temporarily unavailable. Please try again later or contact us by email.',
    windows: 'Windows',
    mac: 'macOS',
    linux: 'Linux',
    notFound: 'No recommended file was found automatically for this device.',
    more: 'More download options'
  }"
/>

## Official app homepage

This page is the official homepage for Wmb Table. It describes the app, provides public documentation, lists downloads, and explains the connected features users can enable.

## How Google user data is used

Wmb Table does not require Google sign-in to read sermons, use the Bible, take notes, or use most of the application.

Google account access is requested only if you enable Google Drive backup and sync. When that feature is turned on, Wmb Table uses your Google account to:

- sign you in through your browser
- show your name and email address in the sync status
- store and sync your backups in your Google Drive `appDataFolder`

Based on the current implementation, this feature may request access to:

- your basic Google profile
- your Google email address
- your Google Drive `appDataFolder`

This feature is optional. If you do not enable it, Wmb Table continues to work locally on your device.

## Privacy and legal information

- [Privacy Policy](/en/privacy)
- [Terms of Service](/en/terms)
- [Contact Us](/en/contact)
- [Backup and Sync Guide](/en/guide/backup-and-sync)

## What you will find in this documentation

<div class="doc-overview-grid">
  <div class="doc-overview-card">
    <h3>To start well</h3>
    <p>The first pages show the main screen, language choice, and the easiest way to open your first content.</p>
  </div>
  <div class="doc-overview-card">
    <h3>To prepare your messages</h3>
    <p>You will learn how to use notes, subjects, the Bible, PDF documents, history, and search.</p>
  </div>
  <div class="doc-overview-card">
    <h3>To listen and keep your work safe</h3>
    <p>A separate group of pages explains voices, audio reading, Google Drive backup, sync, and updates.</p>
  </div>
  <div class="doc-overview-card">
    <h3>For AI chat</h3>
    <p>A dedicated page explains how to use the assistant, find references, and add useful items to subjects more easily.</p>
  </div>
</div>

## Full description of Wmb Table

Wmb Table is a desktop application designed to help users read and study the sermons of William Marrion Branham in a simple and organized way. It brings together sermon reading, the Bible, personal notes, subjects, search, PDF documents, audio, and data backup in one workspace.

Its purpose is not to give you a difficult system. Its purpose is to help a pastor, preacher, or brother preparing a message quickly find a reference, organize thoughts, review an important passage, and keep that work safe.

> [!TIP]
> If this is your first time using Wmb Table, start with [Getting Started](/en/guide/getting-started).

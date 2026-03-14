# Installation

<p class="lead">This page explains how to install Wmb Table on Windows, macOS, and Linux, including the extra authorization step currently required on macOS.</p>

## Before you start

Download Wmb Table from the releases page and choose the file that matches your computer:

- Windows: `.exe`
- macOS Apple Silicon: `.dmg`
- macOS Intel: `.dmg`
- Linux: `.AppImage`, `.deb`, or `.tar.gz`

## Windows

For most users, the easiest file is the `.exe` installer.

<ScreenshotPlaceholder
  file="en-installation-windows-installer.png"
  label="Windows installer or security prompt"
  hint="Show either the Wmb Table installer window or the Windows protection warning that appears before installation."
/>

1. Download the Windows `.exe` file.
2. Open the file.
3. Follow the installer steps shown on screen.
4. Launch Wmb Table after installation finishes.

If Windows shows a protection warning, review the message and continue only if the file came from the official Wmb Table release page.

## macOS

Wmb Table is currently not signed on macOS.

Because of that, macOS may block the first launch until you authorize it manually.

### Install the app

<ScreenshotPlaceholder
  file="en-installation-macos-dmg.png"
  label="macOS DMG window"
  hint="Show the opened DMG with Wmb Table and the Applications folder."
/>

1. Download the `.dmg` file that matches your Mac.
2. Open the `.dmg`.
3. Drag `Wmb Table` into `Applications`.

### Authorize the first launch

<ScreenshotPlaceholder
  file="en-installation-macos-open-anyway.png"
  label="macOS Privacy and Security authorization"
  hint="Show the Privacy and Security page with the blocked app message and the Open Anyway button."
/>

1. Open `Applications`.
2. Try to open `Wmb Table`.
3. When macOS blocks it, close the warning.
4. Open `System Settings`.
5. Go to `Privacy & Security`.
6. Scroll to the security section near the bottom.
7. Find the message saying macOS blocked Wmb Table.
8. Click `Open Anyway`.
9. Confirm by clicking `Open`.

After that, the app should open normally.

### Another possible method

On some Macs, this also works:

1. Open `Applications`.
2. Right-click `Wmb Table`.
3. Click `Open`.
4. Confirm by clicking `Open`.

If macOS still blocks the app, use the `System Settings > Privacy & Security > Open Anyway` method above.

## Linux

You can choose the package format that fits your system best.

### AppImage

This is usually the simplest option.

<ScreenshotPlaceholder
  file="en-installation-linux-appimage.png"
  label="Linux AppImage file or launch step"
  hint="Show the downloaded AppImage file, its executable permission, or the first launch from the file manager."
/>

1. Download the `.AppImage` file.
2. Make it executable if needed.
3. Open it.

If your file manager does not let you launch it directly, run:

```bash
chmod +x Wmb-Table-*.AppImage
./Wmb-Table-*.AppImage
```

### Debian or Ubuntu

If you prefer a system package, download the `.deb` file and install it with your package manager.

### tar.gz

Use this if you prefer a manual portable install.

Extract the archive, then open the application from the extracted folder.

## Which file should you choose

- Windows: use `.exe`
- macOS: use the `.dmg` that matches your Mac
- Linux: use `.AppImage` first unless you specifically want `.deb` or `.tar.gz`

## If the app does not open

- confirm that you downloaded the correct file for your system
- on macOS, complete the manual authorization in `Privacy & Security`
- on Linux, make sure the AppImage is executable
- download the file again if the first download was incomplete

## See also

- [Getting Started](/en/guide/getting-started)
- [Questions and Troubleshooting](/en/guide/troubleshooting)

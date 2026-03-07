# Wmb Table

<div align="center">
    <img src="https://wmb-table.web.app/icon.png" width="20%" />
</div>

Wmb Table is a desktop application for managing and structuring sermons and documents. It includes over 1000 sermons from Prophet [William Marrion Branham](https://wmb-table.web.app/) with multi-language support.

## Features

- 1000+ sermons with multi-language translations
- Full-text search across all documents
- Upload custom PDF documents
- Organize references by topics, notes, and subjects
- Rich text note editor with sermon and Bible references
- Bible reader with multiple versions (local and downloadable)
- Google Drive sync for notes, subjects, and custom documents
- Audio playback with time tracking
- Document history
- Auto-update support

![Screen](https://wmb-table.web.app/assets/images/hero-c4871637fbad4c68f2b50b1afcf97c31.png)

## Tech Stack

- **Runtime**: Electron 40 + Node.js 20+
- **Build**: electron-vite + electron-builder
- **Frontend**: React 19, Ant Design 6, Zustand, Framer Motion
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Search**: Tantivy (Rust-based full-text search)
- **Sync**: Google Drive API

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9

### Installation

```bash
git clone https://github.com/paradoxe35/wmb-table.git
cd wmb-table
pnpm install
```

### Development

```bash
pnpm dev
```

### Testing

```bash
pnpm test              # run tests
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage
```

### Linting & Formatting

```bash
pnpm lint              # check
pnpm lint:fix          # auto-fix
pnpm format            # format with prettier
pnpm typecheck         # typecheck all targets
```

### Packaging

```bash
pnpm package           # build for current platform
```

Build outputs:

| Platform    | Formats                         |
| ----------- | ------------------------------- |
| Windows x64 | `.exe` (NSIS installer), `.zip` |
| macOS arm64 | `.dmg` (Apple Silicon)          |
| macOS x64   | `.dmg` (Intel)                  |
| Linux x64   | `.AppImage`, `.deb`, `.tar.gz`  |

### Database

```bash
pnpm db:generate       # generate migrations
pnpm db:migrate        # run migrations
pnpm db:studio         # open Drizzle Studio
```

## License

MIT

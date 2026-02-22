# File Size Viewer

A desktop application built with Electron and React that helps you visualize and analyze disk usage across your file system.

## Features

- Select any folder and instantly visualize its contents by size
- Color-coded size bars show relative disk usage at a glance
- Expand directories lazily — subdirectories are scanned on demand
- "Unfoldered Files" group separates loose files from subfolders
- Image preview on hover for common formats (jpg, png, gif, bmp, webp)
- Open any file or folder directly in the system file explorer
- Send files and folders to the Recycle Bin with a confirmation prompt
- Real-time scan progress log while scanning large directories
- Dark theme UI

## Prerequisites

- Node.js v18 or higher
- npm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/filesizeviewer.git
cd filesizeviewer
```

2. Install dependencies:
```bash
npm install
```

## Development

Run both commands in separate terminals:

```bash
# Terminal 1 — rebuild renderer on file changes
npm run watch

# Terminal 2 — launch the Electron app
npm start
```

DevTools open automatically in development (i.e. when the app is not packaged).

## Building

Compile the renderer bundle in production mode (minified, no source maps):

```bash
npm run build
```

Then launch the app:

```bash
npm start
```

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| UI | React 19 |
| Bundler | Webpack 5 |
| Transpiler | Babel 7 |

## Security

This project follows Electron security best practices:

- **Context isolation** — `contextIsolation: true` and `nodeIntegration: false` are set on every `BrowserWindow`. The renderer has no direct access to Node.js.
- **Preload / contextBridge** — All IPC communication goes through a typed `window.electronAPI` object exposed via `contextBridge`. Raw `ipcRenderer` is never accessible in the renderer.
- **Input validation** — Every IPC argument is type-checked in both the preload script and the main-process handlers. All file paths are normalised with `path.normalize()` to prevent path-traversal attacks.
- **Navigation guard** — The `will-navigate` event blocks the renderer from navigating to any URL outside the app's own origin.
- **No new windows** — `setWindowOpenHandler` denies any attempt by the renderer to open a new `BrowserWindow` (e.g. via `window.open`).
- **Content Security Policy** — The HTML meta CSP restricts scripts to `'self'` only (no `unsafe-eval`), inline styles are permitted for the CSS-in-JS runtime, and images allow `file:` and `data:` URIs for local previews.
- **Dev-only DevTools** — `openDevTools()` is gated on `!app.isPackaged` and will never appear in a production build.
- **Unhandled rejections** — Main-process unhandled promise rejections are caught and logged rather than silently swallowed.

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

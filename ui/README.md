# TwinPics — desktop UI (Tauri + React)

Static shell for the image index: sidebar (indices) + two search tabs with placeholder “Match image” results.

## Dev

```bash
cd ui
npm install
npm run tauri dev
```

## Build

```bash
npm run build
npm run tauri build
```

## Workspace

The repo root is a Cargo workspace; this crate is **excluded** from it so `cargo` commands run from `ui/src-tauri` stay isolated (see `../Cargo.toml` `exclude`).

## Icons

- Page / favicon: `public/icon.png` (from `../src-image/icon.png`)
- Window & bundle: generated under `src-tauri/icons/` via `npx tauri icon ../src-image/icon.png`

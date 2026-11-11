# Pushistick Desktop

A Windows-first desktop app for building and running sequential AI prompt workflows through the official Antigravity CLI.

## Status

Initial development scaffold. The app includes local workflow management and a sequential runner. Antigravity integration requires the official `agy` CLI to be installed and authenticated on the same computer.

## Requirements

- Windows 10/11 (x64)
- Node.js 20.19+ or 22.12+
- npm
- Google Antigravity CLI (`agy`) installed and authenticated

## Development

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
npm run dist:win
```

The installer is written to `release/`.

## Safety

Pushistick does not store Google credentials. It starts the locally installed `agy` executable and communicates through its documented JSON streaming interface. Agent permissions remain controlled by Antigravity; Pushistick does not enable permission bypass flags.

## License

All rights reserved until a license is selected.

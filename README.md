# Pushistick Desktop

A Windows-first desktop app for building and running sequential AI prompt workflows through the official Antigravity CLI.

## What is included in v0.1

- Dark desktop interface (Electron + React + TypeScript)
- Local workflow templates with any number of sequential prompt steps
- A per-run dynamic input variable: put `{{input}}` anywhere in a step prompt
- Sequential Antigravity CLI execution using the documented NDJSON streaming protocol
- Waits for the CLI `result` event before sending the next step
- Local SQLite storage for templates, run statuses, errors, and step responses
- Run history, event log, and stop control
- Windows NSIS installer configuration

## Requirements

- Windows 10/11 (x64)
- Node.js 22 LTS and npm
- Google Antigravity CLI (`agy`) installed and authenticated on the same computer

## Run in development

Open PowerShell in the repository folder:

```powershell
npm install
npm run dev
```

## Connect Antigravity

1. Install the official Antigravity CLI using Google's current instructions.
2. Open PowerShell and run `agy`.
3. Complete Google authentication in the CLI.
4. Close the CLI session and open Pushistick.
5. Open **Settings → Antigravity CLI** and select **Check again**.

Pushistick checks whether the CLI executable is available. Authentication is confirmed when the first workflow successfully runs.

## Create and run a workflow

1. Open **My templates** and select **New template**.
2. Give the template a name and add prompt steps.
3. Put `{{input}}` in a prompt wherever you want to insert text entered at launch.
4. Save the template and select **Run**.
5. Enter the initial text when prompted. Pushistick replaces every `{{input}}` occurrence, sends steps in order, and waits for a successful CLI result between steps.
6. Open **Runs** to inspect saved responses and execution status.

## Build a Windows installer

```powershell
npm run typecheck
npm run build
npm run dist:win
```

The installer is written to `release/Pushistick Setup.exe` (exact filename may include the version).

## Local data

Workflow templates and run history are stored in a SQLite database inside Electron's application user-data directory. The database stays on this computer.

## Safety and current limitations

- Pushistick does not ask for or store your Google password.
- It uses the locally installed `agy` executable and Antigravity's documented stream-json protocol.
- It does not pass permission-bypass flags. Antigravity's own permission settings remain in effect.
- The current version runs one workflow at a time.
- A workflow run uses a new CLI conversation. Reusing a previous conversation, schedules, parallel queues, cloud sync, and billing are not included yet.
- The current version has not yet been verified on the user's Windows computer; the Windows CI workflow checks compilation and packaging prerequisites.

## Official CLI documentation

- [Headless mode and streaming sessions](https://antigravity.google/docs/cli/headless/)
- [CLI command reference](https://antigravity.google/docs/cli/reference/)

## License

All rights reserved until a license is selected.

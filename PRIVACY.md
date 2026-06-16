# Privacy

Mermaid Fixer is a local Obsidian plugin for repairing Mermaid diagrams and Markdown tables. It does not operate a hosted service and does not collect, transmit, sell, or share your vault data.

## Data flow

| Feature | Default | Local files written | Data sent off device | User control |
| :--- | :--- | :--- | :--- | :--- |
| Fix current file | Manual command | The active note, only after confirmation when diff preview is enabled | None | Run the command only when needed; keep diff preview enabled |
| Fix whole vault | Manual command | Markdown files selected by the scan result, only after confirmation | None | Configure skipped directories and max file size; review the scan summary before applying |
| Plugin settings | On save | Obsidian plugin data managed by `Plugin.saveData()` | None | Change or reset settings in Obsidian |

## Network use

Mermaid and table repairs both run locally. Mermaid Fixer does not make network requests.

## Payments

Mermaid Fixer is free. It has no paid features, license checks, subscriptions, account requirements, donations, or third-party paid API integrations.

## Logs and diagnostics

The plugin shows Obsidian notices, scan progress, and preview modals for user-visible results. It does not create diagnostic logs, send telemetry, or store note contents outside the notes that you explicitly choose to modify.

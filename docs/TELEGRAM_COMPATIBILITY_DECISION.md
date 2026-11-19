# Telegram integration — compatibility decision

Date: 2026-11-19

## Owner decision

The project owner has explicitly instructed that the existing Telegram integration remain unchanged because it is working reliably.

## Scope

- Keep the current RTDB `telegramConfig` node and its existing read permission.
- Keep the current client-side Telegram configuration listener and notification delivery flow.
- Do not migrate Telegram sending to Cloud Functions or another backend in this work.
- Do not rotate, replace, delete, or expose the bot token in source code or documentation.
- Preserve the RTDB Emulator compatibility test that verifies the existing Telegram config read behavior.

## Security status — accepted risk

The existing design exposes the Telegram bot token to authenticated app sessions that can read `telegramConfig`. This remains a known security risk. The owner has chosen operational continuity over changing this working integration at this time. This decision does not mean the token is protected or that the Telegram finding is technically remediated.

Any future change to Telegram permissions, delivery architecture, or bot credentials requires a separate owner decision and an end-to-end notification test plan.

## Work that may continue independently

Admin custom-claim authorization, verified-email enforcement, RTDB Rules validation, and other application security work may continue provided it does not change Telegram configuration access or delivery behavior.

Production RTDB Rules changes, Functions deployment, application deployment, and changes to `main` still require explicit owner approval.

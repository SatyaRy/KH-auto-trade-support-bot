# Telegram Support Bot (NestJS)

NestJS-based Telegram bot that shows support topics (e.g., “What is a VPS?”, “How to set up the bot”) as inline buttons and replies with the matching video guide.

## Setup

1) Install dependencies (pnpm preferred)
```
pnpm install
```
2) Configure your bot token  
Create `.env` (or edit `.env.example`) with:
```
TELEGRAM_BOT_TOKEN=your_botfather_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_BUCKET=videos
```
3) Run the bot (HTTP server + Telegram worker)
```
pnpm run start        # uses ts-node
# or build + run
pnpm run build && node dist/main.js
```
The HTTP server exposes simple endpoints (e.g., `/telegram/options`, `/telegram/health`) while the Telegram worker runs via `OnModuleInit`.

## Customizing support videos

- Videos are expected to be stored in Supabase Storage; set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_BUCKET`.
- Update `videoOptions` in `src/telegram/telegram.service.ts` with your storage paths (e.g., `videos/learn-vps.mp4`).
- Add new topics by extending the `videoOptions` map; each entry has a `label`, `caption`, and `storagePath`.
- The bot responds with a success message immediately and attempts to send the video via a signed Supabase URL if configured.

## Usage

- In Telegram, send `/start` or `/help` to your bot to see the menu.
- Tap an option button and the bot will send the corresponding video (streaming-enabled if supported by Telegram).

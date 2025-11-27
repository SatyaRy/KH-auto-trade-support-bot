# Telegram Support Bot (NestJS)

NestJS-based Telegram bot that shows support topics (e.g., “What is a VPS?”, “How to set up the bot”) as inline buttons and replies with the matching video guide.

## Setup

1) Install dependencies (pnpm preferred)
```
pnpm install
```
2) Configure your bot token and webhook  
Create `.env` (or edit `.env.example`) with:
```
BOT_TOKEN=your_botfather_token_here
WEBHOOK_URL=https://your-vercel-deployment.vercel.app/telegram/webhook
TELEGRAM_BOT_TOKEN=your_botfather_token_here                 # legacy key, optional fallback
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_BUCKET=videos
TELEGRAM_WEBHOOK_URL=https://your-vercel-deployment.vercel.app/telegram/webhook   # optional: alias for WEBHOOK_URL
TELEGRAM_WEBHOOK_SECRET=super_secret_token                       # optional: validates Telegram webhook header
```
3) Run the bot (HTTP server + Telegram worker)
```
pnpm run start        # uses ts-node
# or build + run
pnpm run build && node dist/main.js
```
The HTTP server exposes simple endpoints (e.g., `/telegram/options`, `/telegram/health`) while the Telegram worker configures a Telegram webhook via `OnModuleInit`.

## Deploying with webhooks (Vercel-friendly)

- The bot always uses webhooks (no long polling). Telegram should call `POST /telegram/webhook` on your deployed Nest server.
- Set `WEBHOOK_URL` (or `TELEGRAM_WEBHOOK_URL`) to the full path, e.g., `https://your-app.vercel.app/telegram/webhook`.
- Set `TELEGRAM_WEBHOOK_SECRET` and use the same value when Telegram sends requests; the bot rejects webhook calls with the wrong secret header.

## Customizing support videos

- Videos are expected to be stored in Supabase Storage; set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_BUCKET`.
- Update `videoOptions` in `src/telegram/telegram.service.ts` with your storage paths (e.g., `videos/learn-vps.mp4`).
- Add new topics by extending the `videoOptions` map; each entry has a `label`, `caption`, and `storagePath`.
- The bot responds with a success message immediately and attempts to send the video via a signed Supabase URL if configured.

## Usage

- In Telegram, send `/start` or `/help` to your bot to see the menu.
- Tap an option button and the bot will send the corresponding video (streaming-enabled if supported by Telegram).

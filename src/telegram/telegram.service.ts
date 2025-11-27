import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { Update } from 'telegraf/types';

import { SupabaseService } from '../supabase/supabase.service';

type VideoOptionKey =
  | 'exness_referral'
  | 'create_cent_account'
  | 'claim_bot_bhub'
  | 'learn_vps'
  | 'buy_vps'
  | 'connect_vps'
  | 'setup_bot_vps'
  | 'clone_bot_one_account'
  | 'copy_bot_settings_balances';

type VideoOption = {
  label: string;
  caption: string;
  storagePath: string;
};

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private readonly logger = new Logger(TelegramService.name);

  private readonly videoOptions: Record<VideoOptionKey, VideoOption>;
  private readonly introMessage =
    'Hi! Choose a support topic below and I will send you the matching guide.\n\nYou can type /help any time to see this menu again.';
  private readonly menuMarkup: ReturnType<typeof Markup.inlineKeyboard>;
  private readonly signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

  private readonly supabaseBucket: string | null;
  private readonly webhookUrl: string | null;
  private readonly webhookSecret: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.supabaseBucket = this.configService.get<string>('SUPABASE_BUCKET') ?? null;
    this.videoOptions = {
      exness_referral: {
        label: 'Create an Exness account using Varvannareach referral.',
        caption: 'Steps to sign up with the referral link.',
        storagePath: 'videos/exness-referral.mp4',
      },
      create_cent_account: {
        label: 'Create a Standard Cent account for bot setup.',
        caption: 'Guide to creating the correct Exness account type.',
        storagePath: 'videos/create-cent-account.mp4',
      },
      claim_bot_bhub: {
        label: 'Submit or claim the bot from Bhub.',
        caption: 'How to claim your bot entitlement via Bhub.',
        storagePath: 'videos/claim-bot-bhub.mp4',
      },
      learn_vps: {
        label: 'Learn what a VPS is and how it works.',
        caption: 'Intro to VPS concepts and why they matter.',
        storagePath: 'videos/learn-vps.mp4',
      },
      buy_vps: {
        label: 'Learn how to buy a VPS from the website.',
        caption: 'Walkthrough for purchasing a VPS.',
        storagePath: 'videos/buy-vps.mp4',
      },
      connect_vps: {
        label:
          'Learn how to connect to a remote VPS (phone, iPad, computer, Mac).',
        caption: 'Connection steps for each device type.',
        storagePath: 'videos/connect-vps.mp4',
      },
      setup_bot_vps: {
        label: 'Learn how to set up the bot on the VPS.',
        caption: 'Full deployment guide on your VPS.',
        storagePath: 'videos/setup-bot-vps.mp4',
      },
      clone_bot_one_account: {
        label: 'Learn how to clone the bot to run on one account.',
        caption: 'Cloning and running the bot for a single account.',
        storagePath: 'videos/clone-bot-one-account.mp4',
      },
      copy_bot_settings_balances: {
        label:
          'Learn how to copy bot settings for balances like 5K, 10K, and higher.',
        caption: 'Recommended settings across common balance tiers.',
        storagePath: 'videos/copy-bot-settings-balances.mp4',
      },
    };

    this.menuMarkup = Markup.inlineKeyboard(
      Object.entries(this.videoOptions).map(([key, option]) => [
        Markup.button.callback(option.label, key),
      ]),
    );

    this.webhookUrl =
      this.configService.get<string>('WEBHOOK_URL') ??
      this.configService.get<string>('TELEGRAM_WEBHOOK_URL') ??
      null;
    this.webhookSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? null;
  }

  async onModuleInit(): Promise<void> {
    if (this.bot) {
      return;
    }

    const token =
      this.configService.get<string>('BOT_TOKEN') ??
      this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.error(
        'BOT_TOKEN is missing. Set it in your environment or .env file.',
      );
      throw new Error('BOT_TOKEN is not set.');
    }

    this.bot = new Telegraf(token, { handlerTimeout: 10_000 });

    this.registerHandlers();

    await this.configureWebhook();
    this.logger.log('Telegram bot is running with webhooks');
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      this.logger.log('Removed Telegram bot webhook');
    }
  }

  private async configureWebhook(): Promise<void> {
    const bot = this.bot;
    if (!bot) {
      return;
    }

    if (!this.webhookUrl) {
      this.logger.error('WEBHOOK_URL/TELEGRAM_WEBHOOK_URL is missing; cannot start webhook bot');
      return;
    }

    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.telegram.setWebhook(this.webhookUrl, {
      secret_token: this.webhookSecret ?? undefined,
      allowed_updates: ['message', 'callback_query'],
    });

    this.logger.log(`Webhook configured at ${this.webhookUrl}`);
  }

  private registerHandlers(): void {
    const bot = this.bot;
    if (!bot) {
      return;
    }

    bot.start((ctx) => ctx.reply(this.introMessage, this.menuMarkup));
    bot.help((ctx) => ctx.reply(this.introMessage, this.menuMarkup));

    bot.on('callback_query', async (ctx) => {
      const callbackQuery = ctx.callbackQuery;
      const data =
        callbackQuery && 'data' in callbackQuery
          ? (callbackQuery.data as string | undefined)
          : undefined;

      const option = data && this.isVideoOptionKey(data) ? this.videoOptions[data] : null;
      if (!option) {
        await ctx.answerCbQuery('Unknown option');
        return;
      }

      await ctx.answerCbQuery('Success ✅');
      await ctx.replyWithHTML(`Success: <b>${option.label}</b>\n\n${option.caption}`);

      const videoUrl = await this.getVideoUrl(option);
      if (videoUrl) {
        await ctx.replyWithVideo({ url: videoUrl }, { caption: option.caption });
      } else {
        await ctx.reply(
          'Video will be delivered soon. (Supabase storage not configured or file not found.)',
        );
      }
    });
  }

  private async getVideoUrl(option: VideoOption): Promise<string | null> {
    const bucket = this.supabaseBucket;
    if (!bucket) {
      this.logger.warn(
        `Supabase bucket not configured. Set SUPABASE_BUCKET to serve videos for: ${option.label}`,
      );
      return null;
    }

    const cacheKey = `${bucket}:${option.storagePath}`;
    const cached = this.signedUrlCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now + 15_000) {
      return cached.url;
    }

    const expiresInSeconds = 3600;
    const url = await this.supabaseService.getSignedUrl(
      bucket,
      option.storagePath,
      expiresInSeconds,
    );

    if (url) {
      const expiresAt = now + expiresInSeconds * 1000;
      this.signedUrlCache.set(cacheKey, { url, expiresAt });
    }

    return url;
  }

  private isVideoOptionKey(value: string): value is VideoOptionKey {
    return value in this.videoOptions;
  }

  getOptions(): Array<VideoOption & { key: VideoOptionKey }> {
    return Object.entries(this.videoOptions).map(([key, option]) => ({
      key: key as VideoOptionKey,
      ...option,
    }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async handleWebhookUpdate(
    update: Update,
    secretFromHeader?: string,
  ): Promise<{ ok: boolean }> {
    if (this.webhookSecret && this.webhookSecret !== secretFromHeader) {
      this.logger.warn('Rejected Telegram webhook: invalid secret token');
      return { ok: false };
    }

    if (!this.bot) {
      this.logger.error('Webhook received before bot was initialized');
      return { ok: false };
    }

    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}

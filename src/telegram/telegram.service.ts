import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';

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
  private bot: TelegramBot | null = null;
  private readonly logger = new Logger(TelegramService.name);

  private readonly videoOptions: Record<VideoOptionKey, VideoOption>;

  private readonly supabaseBucket: string | null;

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
  }

  async onModuleInit(): Promise<void> {
    if (this.bot) {
      return;
    }

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.error(
        'TELEGRAM_BOT_TOKEN is missing. Set it in your environment or .env file.',
      );
      throw new Error('TELEGRAM_BOT_TOKEN is not set.');
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.registerHandlers();

    this.logger.log('Telegram bot is running with long polling');
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.logger.log('Stopped Telegram bot polling');
    }
  }

  private registerHandlers(): void {
    const bot = this.bot;
    if (!bot) {
      return;
    }

    bot.onText(/\/(start|help)/, (msg) => {
      const chatId = msg.chat.id;
      const intro =
        'Hi! Choose a support topic below and I will send you the matching guide.\n\nYou can type /help any time to see this menu again.';
      bot.sendMessage(chatId, intro, {
        reply_markup: { inline_keyboard: this.buildKeyboard() },
      });
    });

    bot.on('callback_query', async (query) => {
      const data = query.data as VideoOptionKey | undefined;
      const option = data ? this.videoOptions[data] : null;

      if (!option || !query.message) {
        if (query.id) {
          await bot.answerCallbackQuery(query.id, {
            text: "Sorry, I don't recognize that option.",
            show_alert: false,
          });
        }
        return;
      }

      const chatId = query.message.chat.id;
      await bot.answerCallbackQuery(query.id, { text: 'Success ✅' });
      await bot.sendMessage(
        chatId,
        `Success: <b>${option.label}</b>\n\n${option.caption}`,
        { parse_mode: 'HTML' },
      );

      const videoUrl = await this.getVideoUrl(option);
      if (videoUrl) {
        await bot.sendVideo(chatId, videoUrl, {
          caption: option.caption,
        });
      } else {
        await bot.sendMessage(
          chatId,
          'Video will be delivered soon. (Supabase storage not configured or file not found.)',
        );
      }
    });
  }

  private buildKeyboard(): InlineKeyboardButton[][] {
    return Object.entries(this.videoOptions).map(([key, option]) => [
      { text: option.label, callback_data: key },
    ]);
  }

  private async getVideoUrl(option: VideoOption): Promise<string | null> {
    const bucket = this.supabaseBucket;
    if (!bucket) {
      this.logger.warn(
        `Supabase bucket not configured. Set SUPABASE_BUCKET to serve videos for: ${option.label}`,
      );
      return null;
    }

    return this.supabaseService.getSignedUrl(bucket, option.storagePath);
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
}

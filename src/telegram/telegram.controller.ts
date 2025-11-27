import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { Update } from 'telegraf/types';

import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('options')
  getOptions() {
    return this.telegramService.getOptions();
  }

  @Get('health')
  health() {
    return { status: 'ok', source: 'telegram-bot' };
  }

  @Post('webhook')
  handleWebhook(
    @Body() update: Update,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    return this.telegramService.handleWebhookUpdate(update, secretToken);
  }
}

import { Controller, Get } from '@nestjs/common';

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
}

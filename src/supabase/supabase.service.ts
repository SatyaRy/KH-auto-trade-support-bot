import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!url || !key) {
      this.logger.warn(
        'Supabase is not fully configured. Set SUPABASE_URL and SUPABASE_ANON_KEY to enable signed URLs.',
      );
      return;
    }

    this.client = createClient(url, key);
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 3600,
  ): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      this.logger.error(`Supabase signed URL error for ${path}: ${error.message}`);
      return null;
    }

    return data?.signedUrl ?? null;
  }

  getPublicUrl(bucket: string, path: string): string | null {
    if (!this.client) {
      return null;
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  }
}

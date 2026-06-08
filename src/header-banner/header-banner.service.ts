import { Injectable } from '@nestjs/common';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';

const SETTING_KEY = 'header_banner';

export interface HeaderBanner {
  text: string; // Текст бегущей строки в шапке
  enabled: boolean; // Показывать ли баннер
}

const DEFAULT_BANNER: HeaderBanner = { text: '', enabled: false };

/**
 * Текстовый баннер шапки сайта (одна глобальная бегущая строка).
 * Хранится в settings под ключом 'header_banner' как JSON { text, enabled }.
 */
@Injectable()
export class HeaderBannerService {
  constructor(private readonly settings: AdminSettingsService) {}

  /** Получить текущий баннер шапки (для витрины). */
  async get(): Promise<HeaderBanner> {
    const value = await this.settings.getValue<Partial<HeaderBanner>>(
      SETTING_KEY,
      DEFAULT_BANNER,
    );
    return {
      text: typeof value?.text === 'string' ? value.text : '',
      enabled: value?.enabled === true,
    };
  }

  /** Задать текст и видимость баннера (админ). */
  async set(text: string, enabled: boolean): Promise<HeaderBanner> {
    const banner: HeaderBanner = {
      text: (text || '').trim(),
      enabled: enabled === true,
    };
    await this.settings.upsert(
      SETTING_KEY,
      banner,
      'Текстовый баннер (бегущая строка) в шапке сайта',
    );
    return banner;
  }
}

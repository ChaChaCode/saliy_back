import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  private readonly logger = new Logger(DeliveryController.name);

  constructor(private readonly deliveryService: DeliveryService) {}

  /**
   * Получить список всех стран с типами доставки
   * GET /delivery/countries?lang=ru
   */
  @Get('countries')
  getCountries(@Query('lang') lang?: string) {
    return this.deliveryService.getCountries(lang || 'ru');
  }

  /**
   * Получить информацию о конкретной стране
   * GET /delivery/countries/:code?lang=ru
   */
  @Get('countries/:code')
  getCountryInfo(
    @Param('code') code: string,
    @Query('lang') lang?: string,
  ) {
    const country = this.deliveryService.getCountryInfo(code, lang || 'ru');

    if (!country) {
      return { error: 'Country not found' };
    }

    return country;
  }

  /**
   * Получить список регионов страны
   * GET /delivery/regions?countryCode=RU
   */
  @Get('regions')
  async getRegions(@Query('countryCode') countryCode: string) {
    if (!countryCode) {
      return { error: 'Country code is required' };
    }

    return this.deliveryService.getCdekRegions(countryCode);
  }

  /**
   * Получить список городов региона
   * GET /delivery/cities?countryCode=RU&regionCode=77&search=Москва
   */
  @Get('cities')
  async getCities(
    @Query('countryCode') countryCode: string,
    @Query('regionCode') regionCode?: string,
    @Query('search') search?: string,
  ) {
    if (!countryCode) {
      return { error: 'Country code is required' };
    }

    // Для CDEK стран (RU, BY) требуем либо regionCode, либо search
    const isCdekCountry = ['RU', 'BY'].includes(countryCode.toUpperCase());
    if (isCdekCountry && !regionCode && !search) {
      return {
        error: 'For CDEK countries (RU, BY) regionCode or search is required',
        hint: 'Use /delivery/regions?countryCode=RU to get list of regions first'
      };
    }

    // Парсим regionCode вручную, если он передан
    const parsedRegionCode = regionCode ? parseInt(regionCode, 10) : undefined;

    return this.deliveryService.getCdekCities(countryCode, parsedRegionCode, search);
  }

  /**
   * Получить список пунктов выдачи CDEK в городе
   * GET /delivery/pickup-points?cityCode=44
   */
  @Get('pickup-points')
  async getPickupPoints(@Query('cityCode', ParseIntPipe) cityCode: number) {
    if (!cityCode) {
      return { error: 'City code is required' };
    }

    return this.deliveryService.getCdekPickupPoints(cityCode);
  }

  /**
   * Рассчитать стоимость доставки CDEK
   * GET /delivery/prices?cityCode=44&weight=500&currency=RUB
   */
  @Get('prices')
  async calculateDeliveryPrice(
    @Query('cityCode', ParseIntPipe) cityCode: number,
    @Query('weight', ParseIntPipe) weight?: number,
    @Query('currency') currency?: string,
  ) {
    if (!cityCode) {
      return { error: 'City code is required' };
    }

    try {
      return await this.deliveryService.calculateCdekDeliveryPrice(
        cityCode,
        weight || 500,
        currency || 'RUB',
      );
    } catch (error) {
      return {
        error: 'Failed to calculate delivery price',
        message: error.message,
      };
    }
  }

  /**
   * Получить информацию о заказе CDEK
   * GET /delivery/orders/:uuid
   */
  @Get('orders/:uuid')
  async getCdekOrderInfo(@Param('uuid') uuid: string) {
    try {
      return await this.deliveryService.getCdekOrderInfo(uuid);
    } catch (error) {
      return {
        error: 'Failed to get order info',
        message: error.message,
      };
    }
  }

  /**
   * Получить URL для отслеживания заказа CDEK
   * GET /delivery/tracking/:cdekNumber
   */
  @Get('tracking/:cdekNumber')
  getCdekTrackingUrl(@Param('cdekNumber') cdekNumber: string) {
    return {
      cdekNumber,
      trackingUrl: this.deliveryService.getCdekTrackingUrl(cdekNumber),
    };
  }

  /**
   * Webhook для получения обновлений от CDEK
   * POST /delivery/webhook
   */
  @Post('webhook')
  async handleCdekWebhook(@Body() payload: any) {
    this.logger.log(`CDEK webhook received: ${JSON.stringify(payload)}`);

    try {
      const result = await this.deliveryService.handleCdekWebhook(payload);
      this.logger.log(`CDEK webhook processed: ${JSON.stringify(result)}`);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(`CDEK webhook error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as countries from 'i18n-iso-countries';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private cdekToken: string | null = null;
  private cdekTokenExpiresAt: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Регистрируем локали для разных языков
    countries.registerLocale(require('i18n-iso-countries/langs/ru.json'));
    countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
    countries.registerLocale(require('i18n-iso-countries/langs/pl.json'));
  }

  /**
   * Получить базовый URL CDEK API в зависимости от режима
   */
  private getCdekApiUrl(): string {
    const isTestMode = this.configService.get<string>('CDEK_TEST_MODE') === 'true';
    return isTestMode
      ? 'https://api.edu.cdek.ru/v2'
      : 'https://api.cdek.ru/v2';
  }

  /**
   * Получить креденшелы CDEK в зависимости от режима
   */
  private getCdekCredentials() {
    const isTestMode = this.configService.get<string>('CDEK_TEST_MODE') === 'true';

    if (isTestMode) {
      return {
        clientId: this.configService.get<string>('CDEK_CLIENT_ID_TEST'),
        clientSecret: this.configService.get<string>('CDEK_CLIENT_SECRET_TEST'),
      };
    }

    return {
      clientId: this.configService.get<string>('CDEK_CLIENT_ID'),
      clientSecret: this.configService.get<string>('CDEK_CLIENT_SECRET'),
    };
  }

  /**
   * Получить токен доступа CDEK (с кэшированием)
   */
  private async getCdekToken(): Promise<string> {
    // Проверяем, есть ли действующий токен
    if (this.cdekToken && Date.now() < this.cdekTokenExpiresAt) {
      return this.cdekToken;
    }

    const { clientId, clientSecret } = this.getCdekCredentials();
    const apiUrl = this.getCdekApiUrl();

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', clientId || '');
      params.append('client_secret', clientSecret || '');

      const response = await firstValueFrom(
        this.httpService.post(
          `${apiUrl}/oauth/token`,
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      this.cdekToken = response.data.access_token;
      // Токен действителен 3600 секунд, обновим за 5 минут до истечения
      this.cdekTokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;

      this.logger.log('CDEK token получен успешно');
      return this.cdekToken as string;
    } catch (error) {
      this.logger.error('Ошибка получения CDEK токена:', error.message);
      throw new Error('Не удалось получить токен CDEK API');
    }
  }

  /**
   * Выполнить запрос к CDEK API с авторизацией
   */
  private async cdekRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const token = await this.getCdekToken();
    const apiUrl = this.getCdekApiUrl();

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${apiUrl}${endpoint}`,
          data,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Ошибка запроса к CDEK API (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Получить список всех стран с поддержкой типов доставки
   */
  getCountries(lang: string = 'ru') {
    const allCodes = Object.keys(countries.getAlpha2Codes());
    const cdekCountries = ['RU', 'BY'];

    return {
      countries: allCodes.map((code) => {
        const name = countries.getName(code, lang) || code;
        const isCdekSupported = cdekCountries.includes(code);

        return {
          code,
          name,
          deliveryTypes: isCdekSupported
            ? ['CDEK_PICKUP', 'CDEK_COURIER', 'STANDARD']
            : ['STANDARD'],
        };
      }),
    };
  }

  /**
   * Получить информацию о конкретной стране
   */
  getCountryInfo(countryCode: string, lang: string = 'ru') {
    const name = countries.getName(countryCode, lang);

    if (!name) {
      return null;
    }

    const cdekCountries = ['RU', 'BY'];
    const isCdekSupported = cdekCountries.includes(countryCode);

    return {
      code: countryCode,
      name,
      deliveryTypes: isCdekSupported
        ? ['CDEK_PICKUP', 'CDEK_COURIER', 'STANDARD']
        : ['STANDARD'],
    };
  }

  /**
   * Проверить, поддерживает ли страна доставку CDEK
   */
  isCdekSupported(countryCode: string): boolean {
    const cdekCountries = ['RU', 'BY'];
    return cdekCountries.includes(countryCode);
  }

  /**
   * Получить список регионов страны из CDEK
   */
  async getCdekRegions(countryCode: string) {
    try {
      const response = await this.cdekRequest<any>(
        'GET',
        `/location/regions?country_codes=${countryCode}&size=1000`,
      );

      return {
        regions: response.map((region: any) => ({
          code: region.region_code,
          name: region.region,
          countryCode: region.country_code,
        })),
      };
    } catch (error) {
      this.logger.error('Ошибка получения регионов CDEK:', error);
      return { regions: [] };
    }
  }

  /**
   * Получить список городов региона из CDEK
   */
  async getCdekCities(countryCode: string, regionCode?: number, search?: string) {
    try {
      let url = `/location/cities?country_codes=${countryCode}&size=1000`;

      if (regionCode) {
        url += `&region_code=${regionCode}`;
      }

      if (search) {
        url += `&city=${encodeURIComponent(search)}`;
      }

      const response = await this.cdekRequest<any>('GET', url);

      return {
        cities: response.map((city: any) => ({
          code: city.code,
          name: city.city,
          regionCode: city.region_code,
          region: city.region,
          countryCode: city.country_code,
        })),
      };
    } catch (error) {
      this.logger.error('Ошибка получения городов CDEK:', error);
      return { cities: [] };
    }
  }

  /**
   * Получить список пунктов выдачи CDEK в городе
   */
  async getCdekPickupPoints(cityCode: number) {
    try {
      const response = await this.cdekRequest<any>(
        'GET',
        `/deliverypoints?city_code=${cityCode}&type=PVZ`,
      );

      return {
        points: response.map((point: any) => ({
          code: point.code,
          name: point.name,
          address: `${point.location.address_full}`,
          city: point.location.city,
          coordinates: [
            point.location.longitude,
            point.location.latitude,
          ],
          workTime: point.work_time,
          phones: point.phones?.map((p: any) => p.number) || [],
          isDressingRoom: point.is_dressing_room || false,
          haveCashless: point.have_cashless || false,
        })),
      };
    } catch (error) {
      this.logger.error('Ошибка получения пунктов выдачи CDEK:', error);
      return { points: [] };
    }
  }

  /**
   * Рассчитать стоимость доставки CDEK
   */
  async calculateCdekDeliveryPrice(
    cityCode: number,
    weight: number = 500,
    currency: string = 'RUB',
  ) {
    try {
      const warehouseCityCode = parseInt(
        this.configService.get<string>('CDEK_WAREHOUSE_CITY_CODE') || '9220',
      );

      // Получаем список всех доступных тарифов
      const requestData = {
        from_location: {
          code: warehouseCityCode,
        },
        to_location: {
          code: cityCode,
        },
        packages: [
          {
            weight,
            length: 30,
            width: 20,
            height: 10,
          },
        ],
      };

      this.logger.log(
        `CDEK запрос тарифов: ${JSON.stringify(requestData)}`,
      );

      const tariffList = await this.cdekRequest<any>(
        'POST',
        '/calculator/tarifflist',
        requestData,
      );

      this.logger.log(
        `CDEK тарифы получены: ${tariffList.tariff_codes?.length || 0} тарифов`,
      );

      // Фильтруем тарифы по типу доставки
      const tariffs = tariffList.tariff_codes || [];

      // Коды тарифов для самовывоза (склад-склад)
      const pickupTariffCodes = [136, 234, 368, 378]; // Посылка/Экспресс склад-склад

      // Коды тарифов для курьера (склад-дверь)
      const courierTariffCodes = [137, 233, 139, 366]; // Посылка/Экспресс склад-дверь

      // Находим подходящие тарифы
      const pickupTariff = tariffs.find((t: any) =>
        pickupTariffCodes.includes(t.tariff_code),
      );

      const courierTariff = tariffs.find((t: any) =>
        courierTariffCodes.includes(t.tariff_code),
      );

      return {
        pickup: pickupTariff
          ? {
              tariffCode: pickupTariff.tariff_code,
              tariffName: pickupTariff.tariff_name,
              tariffDescription: pickupTariff.tariff_description,
              deliverySum: pickupTariff.delivery_sum,
              periodMin: pickupTariff.period_min,
              periodMax: pickupTariff.period_max,
              calendarMin: pickupTariff.calendar_min,
              calendarMax: pickupTariff.calendar_max,
              currency,
            }
          : null,
        courier: courierTariff
          ? {
              tariffCode: courierTariff.tariff_code,
              tariffName: courierTariff.tariff_name,
              tariffDescription: courierTariff.tariff_description,
              deliverySum: courierTariff.delivery_sum,
              periodMin: courierTariff.period_min,
              periodMax: courierTariff.period_max,
              calendarMin: courierTariff.calendar_min,
              calendarMax: courierTariff.calendar_max,
              currency,
            }
          : null,
      };
    } catch (error) {
      this.logger.error('Ошибка расчёта стоимости доставки CDEK:', error);
      if (error.response?.data) {
        this.logger.error(
          'CDEK API ответ:',
          JSON.stringify(error.response.data),
        );
      }
      throw error;
    }
  }

  /**
   * Создать заказ в CDEK
   */
  async createCdekOrder(orderData: {
    orderNumber: string;
    deliveryType: 'CDEK_PICKUP' | 'CDEK_COURIER';
    recipient: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
    };
    address: {
      cityCode: number;
      street?: string;
      apartment?: string;
      postalCode?: string;
      pickupPointCode?: string; // Код ПВЗ для самовывоза
    };
    items: Array<{
      name: string;
      sku: string;
      quantity: number;
      price: number;
      weight: number; // в граммах
    }>;
    comment?: string;
  }): Promise<{ uuid: string; cdekNumber: string | null }> {
    try {
      // Определяем тариф в зависимости от типа доставки
      // Код 136 - Посылка склад-склад (ПВЗ)
      // Код 137 - Посылка склад-дверь (курьер)
      const tariffCode = orderData.deliveryType === 'CDEK_PICKUP' ? 136 : 137;

      const warehouseCityCode = parseInt(
        this.configService.get<string>('CDEK_WAREHOUSE_CITY_CODE') || '9220',
      );

      // Формируем packages
      const totalWeight = orderData.items.reduce(
        (sum, item) => sum + item.weight * item.quantity,
        0,
      );

      const packages = [
        {
          number: '1',
          weight: totalWeight || 500, // Минимальный вес 500г
          length: 30,
          width: 20,
          height: 10,
          items: orderData.items.map((item) => ({
            name: item.name,
            ware_key: item.sku,
            payment: { value: 0 }, // Оплата при получении = 0 (предоплата)
            cost: item.price,
            weight: item.weight || 200,
            amount: item.quantity,
          })),
        },
      ];

      // Формируем to_location
      const toLocation: any = {
        code: orderData.address.cityCode,
      };

      // Для курьерской доставки добавляем адрес
      if (orderData.deliveryType === 'CDEK_COURIER') {
        if (orderData.address.street) {
          toLocation.address = orderData.address.street;
        }
        if (orderData.address.apartment) {
          toLocation.address += `, кв. ${orderData.address.apartment}`;
        }
      }

      const requestBody: any = {
        number: orderData.orderNumber,
        tariff_code: tariffCode,
        comment: orderData.comment || `Заказ ${orderData.orderNumber}`,
        sender: {
          company: 'SALIY',
          phones: [{ number: '+375291234567' }],
        },
        recipient: {
          name: `${orderData.recipient.firstName} ${orderData.recipient.lastName}`,
          phones: [{ number: orderData.recipient.phone }],
          email: orderData.recipient.email,
        },
        from_location: {
          code: warehouseCityCode,
        },
        packages,
      };

      // Для ПВЗ отправляем ТОЛЬКО delivery_point (без to_location)
      // Для курьера отправляем ТОЛЬКО to_location (без delivery_point)
      if (
        orderData.deliveryType === 'CDEK_PICKUP' &&
        orderData.address.pickupPointCode
      ) {
        requestBody.delivery_point = orderData.address.pickupPointCode;
      } else {
        requestBody.to_location = toLocation;
      }

      this.logger.log(
        `Creating CDEK order: ${JSON.stringify(requestBody, null, 2)}`,
      );

      const response = await this.cdekRequest<any>('POST', '/orders', requestBody);

      this.logger.log(`CDEK order response: ${JSON.stringify(response)}`);

      // CDEK возвращает entity.uuid
      const uuid = response.entity?.uuid;

      if (!uuid) {
        throw new Error('CDEK не вернул UUID заказа');
      }

      // Номер заказа CDEK придёт через webhook позже
      return { uuid, cdekNumber: null };
    } catch (error) {
      this.logger.error('Ошибка создания заказа в CDEK:', error);
      if (error.response?.data) {
        this.logger.error(
          'CDEK API ответ:',
          JSON.stringify(error.response.data),
        );
      }
      throw new Error('Не удалось создать заказ в CDEK');
    }
  }

  /**
   * Получить информацию о заказе CDEK по UUID
   */
  async getCdekOrderInfo(uuid: string): Promise<{
    uuid: string;
    cdekNumber: string | null;
    status: string;
    statusCode: string;
  }> {
    try {
      const response = await this.cdekRequest<any>('GET', `/orders/${uuid}`);

      return {
        uuid: response.entity?.uuid,
        cdekNumber: response.entity?.cdek_number || null,
        status: response.entity?.statuses?.[0]?.name || 'Неизвестно',
        statusCode: response.entity?.statuses?.[0]?.code || 'UNKNOWN',
      };
    } catch (error) {
      this.logger.error('Ошибка получения информации о заказе CDEK:', error);
      throw new Error('Не удалось получить информацию о заказе CDEK');
    }
  }

  /**
   * Получить URL для отслеживания заказа CDEK
   */
  getCdekTrackingUrl(cdekNumber: string): string {
    return `https://www.cdek.ru/ru/tracking?order_id=${cdekNumber}`;
  }

  /**
   * Маппинг статусов CDEK на наши статусы заказа
   */
  private readonly cdekStatusMap: Record<string, string> = {
    // Заказ создан/принят
    CREATED: 'CONFIRMED',
    ACCEPTED: 'CONFIRMED',
    // Заказ в обработке/на складе
    RECEIVED_AT_SHIPMENT_WAREHOUSE: 'PROCESSING',
    READY_FOR_SHIPMENT_IN_SENDER_CITY: 'PROCESSING',
    TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY: 'SHIPPED',
    // В пути
    SENT_TO_TRANSIT_CITY: 'SHIPPED',
    ACCEPTED_IN_TRANSIT_CITY: 'SHIPPED',
    TAKEN_BY_TRANSPORTER_FROM_TRANSIT_CITY: 'SHIPPED',
    SENT_TO_RECIPIENT_CITY: 'SHIPPED',
    // Прибыл в город/ПВЗ
    ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE: 'SHIPPED',
    ACCEPTED_AT_PICK_UP_POINT: 'SHIPPED',
    READY_TO_BE_HANDED_OVER: 'SHIPPED',
    // Доставляется курьером
    TAKEN_BY_COURIER: 'SHIPPED',
    // ВРУЧЕН
    RECEIVED: 'DELIVERED',
    DELIVERED: 'DELIVERED',
    // Возврат
    NOT_DELIVERED: 'CANCELLED',
    RETURNED: 'REFUNDED',
    RETURNED_TO_SENDER: 'REFUNDED',
  };

  /**
   * Названия статусов CDEK на русском
   */
  private readonly cdekStatusNames: Record<string, string> = {
    CREATED: 'Создан',
    ACCEPTED: 'Принят',
    RECEIVED_AT_SHIPMENT_WAREHOUSE: 'Принят на склад отправки',
    READY_FOR_SHIPMENT_IN_SENDER_CITY: 'Готов к отправке',
    TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY: 'Забран перевозчиком',
    SENT_TO_TRANSIT_CITY: 'Отправлен в транзитный город',
    ACCEPTED_IN_TRANSIT_CITY: 'Принят в транзитном городе',
    TAKEN_BY_TRANSPORTER_FROM_TRANSIT_CITY: 'Забран из транзитного города',
    SENT_TO_RECIPIENT_CITY: 'Отправлен в город получателя',
    ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE: 'Принят на склад в городе получателя',
    ACCEPTED_AT_PICK_UP_POINT: 'Прибыл в пункт выдачи',
    READY_TO_BE_HANDED_OVER: 'Готов к выдаче',
    TAKEN_BY_COURIER: 'Передан курьеру',
    RECEIVED: 'Вручён',
    DELIVERED: 'Доставлен',
    NOT_DELIVERED: 'Не доставлен',
    RETURNED: 'Возвращён',
    RETURNED_TO_SENDER: 'Возвращён отправителю',
  };

  /**
   * Обработка webhook от CDEK
   */
  async handleCdekWebhook(payload: any): Promise<{
    orderId?: string;
    newStatus?: string;
    cdekStatus?: string;
  }> {
    // CDEK отправляет разные типы событий
    if (payload.type !== 'ORDER_STATUS') {
      this.logger.log(`Ignoring CDEK webhook type: ${payload.type}`);
      return {};
    }

    const uuid = payload.uuid;
    const cdekNumber = payload.attributes?.cdek_number;
    const cdekStatusCode = payload.attributes?.code;
    const cdekStatusName =
      this.cdekStatusNames[cdekStatusCode] ||
      payload.attributes?.name ||
      cdekStatusCode;

    if (!uuid && !cdekNumber) {
      this.logger.warn('CDEK webhook missing uuid and cdek_number');
      return {};
    }

    this.logger.log(
      `CDEK status update: uuid=${uuid}, cdekNumber=${cdekNumber}, status=${cdekStatusCode} (${cdekStatusName})`,
    );

    // Здесь нужна интеграция с вашей базой данных
    // Пример для будущей реализации:
    // const order = await this.prisma.order.findFirst({
    //   where: {
    //     OR: [{ cdekUuid: uuid }, { cdekNumber: cdekNumber }],
    //   },
    // });

    // Возвращаем информацию для логирования
    return {
      orderId: undefined, // Заполнится когда будет интеграция с БД
      newStatus: this.cdekStatusMap[cdekStatusCode],
      cdekStatus: cdekStatusCode,
    };
  }
}

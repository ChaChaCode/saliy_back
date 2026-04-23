import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as countries from 'i18n-iso-countries';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private cdekToken: string | null = null;
  private cdekTokenExpiresAt: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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
   * Россия и Беларусь отображаются первыми
   */
  getCountries(lang: string = 'ru') {
    const allCodes = Object.keys(countries.getAlpha2Codes());
    const cdekCountries = ['RU', 'BY'];
    const priorityCountries = ['RU', 'BY'];

    const allCountriesList = allCodes.map((code) => {
      const name = countries.getName(code, lang) || code;
      const isCdekSupported = cdekCountries.includes(code);

      return {
        code,
        name,
        deliveryTypes: isCdekSupported ? ['CDEK_PICKUP'] : ['STANDARD'],
      };
    });

    // Разделяем на приоритетные (RU, BY) и остальные
    const priority = allCountriesList.filter((country) =>
      priorityCountries.includes(country.code),
    );
    const others = allCountriesList.filter(
      (country) => !priorityCountries.includes(country.code),
    );

    return {
      countries: [...priority, ...others],
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
      deliveryTypes: isCdekSupported ? ['CDEK_PICKUP'] : ['STANDARD'],
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
   * Обработка webhook от CDEK — обновляет статус заказа в БД.
   * CDEK шлёт JSON вида:
   *   { type: 'ORDER_STATUS', uuid: '...', attributes: { code: 'RECEIVED', cdek_number: '...', date_time: '...' } }
   */
  async handleCdekWebhook(payload: any): Promise<{
    orderNumber?: string;
    orderId?: string;
    newStatus?: string;
    cdekStatus?: string;
    cdekStatusName?: string;
  }> {
    if (payload?.type !== 'ORDER_STATUS') {
      this.logger.log(`Ignoring CDEK webhook type: ${payload?.type}`);
      return {};
    }

    const uuid: string | undefined = payload.uuid;
    const cdekNumber: string | undefined = payload.attributes?.cdek_number;
    const cdekStatusCode: string | undefined = payload.attributes?.code;
    const cdekStatusName =
      (cdekStatusCode && this.cdekStatusNames[cdekStatusCode]) ||
      payload.attributes?.name ||
      cdekStatusCode;
    const statusDate = payload.attributes?.date_time
      ? new Date(payload.attributes.date_time)
      : new Date();

    if (!uuid && !cdekNumber) {
      this.logger.warn('CDEK webhook missing uuid and cdek_number');
      return {};
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          ...(uuid ? [{ cdekUuid: uuid }] : []),
          ...(cdekNumber ? [{ cdekNumber: cdekNumber }] : []),
        ],
      },
    });

    if (!order) {
      this.logger.warn(
        `CDEK webhook: заказ не найден (uuid=${uuid}, cdekNumber=${cdekNumber})`,
      );
      return {
        cdekStatus: cdekStatusCode,
        cdekStatusName,
        newStatus: cdekStatusCode ? this.cdekStatusMap[cdekStatusCode] : undefined,
      };
    }

    const mappedStatus = cdekStatusCode ? this.cdekStatusMap[cdekStatusCode] : undefined;
    const shouldUpdateOrderStatus =
      mappedStatus &&
      order.status !== OrderStatus.CANCELLED &&
      order.status !== OrderStatus.REFUNDED &&
      this.isStatusTransitionAllowed(order.status, mappedStatus as OrderStatus);

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        ...(cdekNumber && !order.cdekNumber ? { cdekNumber } : {}),
        ...(uuid && !order.cdekUuid ? { cdekUuid: uuid } : {}),
        cdekStatus: cdekStatusCode,
        cdekStatusName,
        cdekStatusDate: statusDate,
        ...(shouldUpdateOrderStatus
          ? { status: mappedStatus as OrderStatus }
          : {}),
      },
    });

    this.logger.log(
      `CDEK webhook: обновлён заказ ${updated.orderNumber}, cdekStatus=${cdekStatusCode}` +
        (shouldUpdateOrderStatus ? `, status=${mappedStatus}` : ''),
    );

    return {
      orderNumber: updated.orderNumber,
      orderId: updated.id,
      newStatus: mappedStatus,
      cdekStatus: cdekStatusCode,
      cdekStatusName,
    };
  }

  /**
   * Запросить актуальный статус заказа напрямую в CDEK API и записать в БД.
   * Полезно если webhook потерялся.
   */
  async refreshCdekStatusForOrder(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }
    if (!order.cdekUuid && !order.cdekNumber) {
      throw new NotFoundException(
        `У заказа ${orderNumber} нет CDEK-идентификаторов`,
      );
    }

    // Предпочитаем uuid — работает стабильнее на всех средах
    const identifier = order.cdekUuid ?? order.cdekNumber!;
    const cdekOrder = await this.cdekRequest<any>(
      'GET',
      `/orders/${identifier}`,
    );

    // CDEK может вернуть статусы в `entity.statuses` (массив) — берём последний
    const statuses = cdekOrder?.entity?.statuses || [];
    const latest = statuses[statuses.length - 1];
    const cdekStatusCode: string | undefined = latest?.code;
    const cdekStatusName =
      (cdekStatusCode && this.cdekStatusNames[cdekStatusCode]) ||
      latest?.name ||
      cdekStatusCode;
    const statusDate = latest?.date_time
      ? new Date(latest.date_time)
      : new Date();

    const mappedStatus = cdekStatusCode ? this.cdekStatusMap[cdekStatusCode] : undefined;
    const shouldUpdateOrderStatus =
      mappedStatus &&
      order.status !== OrderStatus.CANCELLED &&
      order.status !== OrderStatus.REFUNDED &&
      this.isStatusTransitionAllowed(order.status, mappedStatus as OrderStatus);

    const cdekNumber = cdekOrder?.entity?.cdek_number;

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: {
        ...(cdekNumber && !order.cdekNumber ? { cdekNumber } : {}),
        ...(cdekStatusCode ? { cdekStatus: cdekStatusCode } : {}),
        ...(cdekStatusName ? { cdekStatusName } : {}),
        ...(cdekStatusCode ? { cdekStatusDate: statusDate } : {}),
        ...(shouldUpdateOrderStatus
          ? { status: mappedStatus as OrderStatus }
          : {}),
      },
    });

    this.logger.log(
      `CDEK pull-refresh: ${orderNumber} → ${cdekStatusCode} (${cdekStatusName})`,
    );

    return {
      orderNumber: updated.orderNumber,
      cdekStatus: updated.cdekStatus,
      cdekStatusName: updated.cdekStatusName,
      cdekStatusDate: updated.cdekStatusDate,
      status: updated.status,
      trackingUrl: updated.cdekNumber
        ? this.getCdekTrackingUrl(updated.cdekNumber)
        : null,
    };
  }

  /**
   * Не даём CDEK-статусу «откатить» заказ назад.
   * Например: статус заказа уже DELIVERED — CDEK не должен вернуть SHIPPED.
   */
  private isStatusTransitionAllowed(
    current: OrderStatus,
    next: OrderStatus,
  ): boolean {
    const weight: Record<OrderStatus, number> = {
      PENDING: 0,
      PAYMENT_FAILED: 0,
      CONFIRMED: 1,
      PROCESSING: 2,
      SHIPPED: 3,
      DELIVERED: 4,
      CANCELLED: 99,
      REFUNDED: 99,
    };
    // Меняем только если это ДВИЖЕНИЕ ВПЕРЁД по пайплайну доставки
    return weight[next] > weight[current];
  }
}

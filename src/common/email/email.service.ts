import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const transportOptions: SMTPTransport.Options = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Принудительно IPv4: на сервере исходящий IPv6 не работает, а
      // smtp.gmail.com резолвится и в IPv6 → connect ENETUNREACH на 587.
      // family отсутствует в типах @types/nodemailer, но поддерживается
      // nodemailer в рантайме — добавляем через приведение.
      ...({ family: 4 } as Record<string, unknown>),
    };
    this.transporter = nodemailer.createTransport(transportOptions);

    // Проверяем SMTP-соединение при старте — чтобы проблема с почтой
    // была видна сразу в логах, а не при первой отправке.
    if (process.env.EMAIL_HOST) {
      this.transporter
        .verify()
        .then(() => this.logger.log('SMTP-соединение готово'))
        .catch((e) =>
          this.logger.error(
            `SMTP не настроен/недоступен: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    } else {
      this.logger.warn('EMAIL_HOST не задан — отправка писем отключена');
    }
  }

  /**
   * Безопасная отправка: ошибка SMTP логируется, но НЕ роняет бизнес-операцию
   * (заказ/регистрация не должны падать из-за недоставленного письма).
   * Возвращает true при успехе.
   */
  private async safeSend(
    options: nodemailer.SendMailOptions,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail(options);
      return true;
    } catch (e) {
      this.logger.error(
        `Не удалось отправить письмо "${options.subject}" на ${options.to}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    // Письмо оформлено так, чтобы iOS/macOS предлагали autofill OTP:
    //  - код стоит В НАЧАЛЕ темы письма (главный сигнал для Apple);
    //  - есть plain-text часть (text), а не только HTML;
    //  - код — сплошное число рядом со словом «код» (без пробелов/дефисов);
    //    letter-spacing задаётся только CSS, сам текст кода не разбивается.
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `${code} — код для входа в Saliy Clothes`,
      text:
        `Ваш код для входа: ${code}\n` +
        `Код действителен в течение 10 минут.\n\n` +
        `Если вы не запрашивали этот код, просто проигнорируйте это письмо.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Код подтверждения</h2>
          <p>Ваш код для входа в Saliy Clothes: <strong>${code}</strong></p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Код действителен в течение 10 минут.</p>
          <p style="color: #666; font-size: 12px;">Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
        </div>
      `,
    };

    await this.safeSend(mailOptions);
  }

  /**
   * Отправить email с подтверждением заказа (в стиле печатного чека)
   */
  async sendOrderConfirmation(
    email: string,
    orderData: {
      orderNumber: string;
      firstName: string;
      lastName: string;
      items: Array<{ name: string; size: string; quantity: number; price: number }>;
      originalSubtotal: number;
      subtotal: number;
      discountAmount: number;
      promoCode?: string | null;
      deliveryPrice: number;
      total: number;
      paymentMethod: string;
      paymentUrl?: string;
    },
  ): Promise<void> {
    // Преобразуем enum в читаемый текст
    const paymentMethodNames: Record<string, string> = {
      SBP_TOCHKA: 'СБП (БАНК ТОЧКА)',
      YANDEX_PAY: 'ЯНДЕКС СПЛИТ',
      CARD_ONLINE: 'АЛЬФА-БАНК',
      CARD_MANUAL: 'ОПЛАТА КАРТОЙ ЧЕРЕЗ МЕНЕДЖЕРА',
      CRYPTO: 'КРИПТОВАЛЮТА',
      PAYPAL: 'PAYPAL',
    };
    const paymentMethodText = paymentMethodNames[orderData.paymentMethod] || orderData.paymentMethod;
    const currentDate = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const currentTime = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsHtml = orderData.items
      .map(
        (item, index) => `
        <div style="margin: 10px 0; font-size: 13px; line-height: 1.6; background: #ffffff; color: #000000; text-transform: uppercase;">
          <div style="display: table; width: 100%; table-layout: fixed;">
            <div style="display: table-row;">
              <div style="display: table-cell; color: #000000;">ТОВАР ${index + 1}</div>
              <div style="display: table-cell; text-align: right; font-weight: 600; color: #000000; white-space: nowrap;">${(item.price * item.quantity).toFixed(2)} ₽</div>
            </div>
          </div>
          <div style="color: #666666; font-size: 12px; margin-top: 2px;">
            ${item.name.toUpperCase()}
          </div>
          <div style="color: #666666; font-size: 12px;">
            РАЗМЕР: ${item.size.toUpperCase()} × ${item.quantity} ШТ @ ${item.price.toFixed(2)} ₽
          </div>
        </div>
      `,
      )
      .join('');

    // Plain-text версия чека — для доставляемости (письмо без text-части
    // спам-фильтры оценивают хуже) и для клиентов без HTML.
    const itemsText = orderData.items
      .map(
        (item) =>
          `- ${item.name} (размер ${item.size}) × ${item.quantity} @ ${item.price.toFixed(2)} ₽ = ${(item.price * item.quantity).toFixed(2)} ₽`,
      )
      .join('\n');
    const orderText =
      `SALIY CLOTHES — заказ #${orderData.orderNumber}\n` +
      `${currentDate} ${currentTime}\n\n` +
      `Товары:\n${itemsText}\n\n` +
      `Товары: ${orderData.originalSubtotal.toFixed(2)} ₽\n` +
      (orderData.discountAmount > 0
        ? `Промокод${orderData.promoCode ? ` ${orderData.promoCode}` : ''}: -${orderData.discountAmount.toFixed(2)} ₽\n`
        : '') +
      `Доставка: ${orderData.deliveryPrice.toFixed(2)} ₽\n` +
      `ИТОГО: ${orderData.total.toFixed(2)} ₽\n` +
      `Оплата: ${paymentMethodText}\n` +
      (orderData.paymentUrl ? `\nОплатить заказ: ${orderData.paymentUrl}\n` : '') +
      `\nСпасибо за покупку!`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Заказ #${orderData.orderNumber} оформлен - Saliy Clothes`,
      text: orderText,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 0; background: #e8e8e8; color-scheme: light;">
          <!-- Чек -->
          <div style="background: #ffffff; margin: 0 auto; position: relative; box-shadow: 0 8px 30px rgba(0,0,0,0.15); color: #000000;">
            <!-- Треугольные вырезы сверху -->
            <svg width="400" height="15" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <defs>
                <pattern id="topTriangles" x="0" y="0" width="20" height="15" patternUnits="userSpaceOnUse">
                  <polygon points="0,0 10,15 20,0" fill="#e8e8e8"/>
                </pattern>
              </defs>
              <rect width="400" height="15" fill="url(#topTriangles)"/>
            </svg>

            <!-- Контент чека -->
            <div style="padding: 40px 35px; background: #ffffff; color: #000000;">
              <!-- Заголовок магазина -->
              <div style="text-align: center; margin-bottom: 10px; background: #ffffff; color: #000000; text-transform: uppercase;">
                <div style="font-size: 18px; font-weight: bold; letter-spacing: 4px; color: #000000;">SALIY CLOTHES</div>
                <div style="font-size: 11px; color: #666666; margin-top: 5px; letter-spacing: 1px;">ОНЛАЙН МАГАЗИН</div>
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #cccccc; margin: 15px 0;"></div>

              <!-- RECEIPT -->
              <div style="text-align: center; margin: 15px 0; font-size: 16px; font-weight: bold; letter-spacing: 2px; color: #000000; text-transform: uppercase;">
                *** ЧЕК ***
              </div>

              <!-- Дата и время -->
              <div style="text-align: center; font-size: 11px; color: #666666; margin-bottom: 15px; text-transform: uppercase;">
                <div style="color: #000000;">ЗАКАЗ #${orderData.orderNumber}</div>
                <div style="margin-top: 3px; color: #666666;">${currentDate} - ${currentTime}</div>
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #ccc; margin: 15px 0;"></div>

              <!-- Товары -->
              <div style="margin: 20px 0;">
                ${itemsHtml}
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #ccc; margin: 15px 0;"></div>

              <!-- Итого -->
              <div style="font-size: 13px; line-height: 1.8; background: #ffffff; color: #000000; text-transform: uppercase;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">ТОВАРЫ</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">${orderData.originalSubtotal.toFixed(2)} ₽</td>
                  </tr>
                  ${orderData.originalSubtotal > orderData.subtotal ? `
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">СКИДКА НА ТОВАРЫ</td>
                    <td style="color: #28a745; text-align: right; padding: 4px 0;">-${(orderData.originalSubtotal - orderData.subtotal).toFixed(2)} ₽</td>
                  </tr>` : ''}
                  ${orderData.discountAmount > 0 ? `
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">ПРОМОКОД${orderData.promoCode ? ` ${orderData.promoCode.toUpperCase()}` : ''}</td>
                    <td style="color: #28a745; text-align: right; padding: 4px 0;">-${orderData.discountAmount.toFixed(2)} ₽</td>
                  </tr>` : ''}
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">ДОСТАВКА</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">${orderData.deliveryPrice.toFixed(2)} ₽</td>
                  </tr>
                </table>
                <div style="border-top: 2px dotted #cccccc; margin: 10px 0;"></div>
                <table style="width: 100%; border-collapse: collapse; font-weight: bold; font-size: 15px;">
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">ИТОГО</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">${orderData.total.toFixed(2)} ₽</td>
                  </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;">
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">${paymentMethodText}</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">${orderData.total.toFixed(2)} ₽</td>
                  </tr>
                </table>
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #cccccc; margin: 15px 0;"></div>

              ${
                orderData.paymentUrl
                  ? `
              <!-- Кнопка оплаты -->
              <div style="text-align: center; margin: 20px 0; background: #ffffff;">
                <a href="${orderData.paymentUrl}" style="display: inline-block; background: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 1px; border: 2px solid #000000; text-transform: uppercase;">
                  ОПЛАТИТЬ ЗАКАЗ
                </a>
              </div>

              <div style="border-top: 2px dotted #cccccc; margin: 15px 0;"></div>
              `
                  : ''
              }

              <!-- Благодарность -->
              <div style="text-align: center; margin: 25px 0; font-size: 12px; letter-spacing: 1px; color: #000000; text-transform: uppercase;">
                СПАСИБО ЗА ПОКУПКУ!
              </div>
            </div>

            <!-- Треугольные вырезы снизу -->
            <svg width="400" height="15" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <defs>
                <pattern id="bottomTriangles" x="0" y="0" width="20" height="15" patternUnits="userSpaceOnUse">
                  <polygon points="0,15 10,0 20,15" fill="#e8e8e8"/>
                </pattern>
              </defs>
              <rect width="400" height="15" fill="url(#bottomTriangles)"/>
            </svg>
          </div>
        </div>
      `,
    };

    await this.safeSend(mailOptions);
  }

  /**
   * Отправить произвольное письмо (для админа — рассылки, уведомления)
   */
  async sendRaw(to: string, subject: string, html: string): Promise<boolean> {
    return this.safeSend({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  }
}

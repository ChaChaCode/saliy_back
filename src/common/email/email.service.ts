import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Код подтверждения - Saliy Clothes',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Код подтверждения</h2>
          <p>Ваш код для входа в Saliy Clothes:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Код действителен в течение 10 минут.</p>
          <p style="color: #666; font-size: 12px;">Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
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
      subtotal: number;
      deliveryPrice: number;
      total: number;
      paymentUrl?: string;
    },
  ): Promise<void> {
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
        <div style="margin: 10px 0; font-size: 13px; line-height: 1.6; background: #ffffff; color: #000000;">
          <div style="display: table; width: 100%; table-layout: fixed;">
            <div style="display: table-row;">
              <div style="display: table-cell; color: #000000;">ТОВАР ${index + 1}</div>
              <div style="display: table-cell; text-align: right; font-weight: 600; color: #000000; white-space: nowrap;">${(item.price * item.quantity).toFixed(2)} ₽</div>
            </div>
          </div>
          <div style="color: #666666; font-size: 12px; margin-top: 2px;">
            ${item.name}
          </div>
          <div style="color: #666666; font-size: 12px;">
            РАЗМЕР: ${item.size} × ${item.quantity} ШТ @ ${item.price.toFixed(2)} ₽
          </div>
        </div>
      `,
      )
      .join('');

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Заказ #${orderData.orderNumber} оформлен - Saliy Clothes`,
      html: `
        <div style="font-family: 'Courier New', Courier, monospace; max-width: 400px; margin: 40px auto; padding: 0; background: #e8e8e8; color-scheme: light;">
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
              <div style="text-align: center; margin-bottom: 10px; background: #ffffff; color: #000000;">
                <div style="font-size: 18px; font-weight: bold; letter-spacing: 4px; color: #000000;">SALIY CLOTHES</div>
                <div style="font-size: 11px; color: #666666; margin-top: 5px; letter-spacing: 1px;">ОНЛАЙН МАГАЗИН</div>
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #cccccc; margin: 15px 0;"></div>

              <!-- RECEIPT -->
              <div style="text-align: center; margin: 15px 0; font-size: 16px; font-weight: bold; letter-spacing: 2px; color: #000000;">
                *** ЧЕК ***
              </div>

              <!-- Дата и время -->
              <div style="text-align: center; font-size: 11px; color: #666666; margin-bottom: 15px;">
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
              <div style="font-size: 13px; line-height: 1.8; background: #ffffff; color: #000000;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">ТОВАРЫ</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">${orderData.subtotal.toFixed(2)} ₽</td>
                  </tr>
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
                    <td style="color: #000000; padding: 4px 0;">НАЛИЧНЫЕ</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">${orderData.total.toFixed(2)} ₽</td>
                  </tr>
                  <tr>
                    <td style="color: #000000; padding: 4px 0;">СДАЧА</td>
                    <td style="color: #000000; text-align: right; padding: 4px 0;">0.00 ₽</td>
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
                <a href="${orderData.paymentUrl}" style="display: inline-block; background: #000000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 1px; border: 2px solid #000000;">
                  ОПЛАТИТЬ ЗАКАЗ
                </a>
              </div>

              <div style="border-top: 2px dotted #cccccc; margin: 15px 0;"></div>
              `
                  : ''
              }

              <!-- Благодарность -->
              <div style="text-align: center; margin: 25px 0; font-size: 12px; letter-spacing: 1px; color: #000000;">
                СПАСИБО ЗА ПОКУПКУ!
              </div>

              <!-- QR код -->
              <div style="text-align: center; margin: 25px 0; background: #ffffff;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.youtube.com/watch?v=dQw4w9WgXcQ" alt="QR Code" style="width: 150px; height: 150px; border: 2px solid #000000; padding: 5px; background: #ffffff;">
                <div style="font-size: 10px; margin-top: 8px; letter-spacing: 2px; color: #666666;">ОТСКАНИРУЙТЕ ДЛЯ ОТСЛЕЖИВАНИЯ</div>
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

          <!-- Информация под чеком -->
          <div style="text-align: center; margin-top: 30px; padding: 0 20px; color: #999999; font-size: 11px; font-family: Arial, sans-serif; background: transparent;">
            <p style="margin: 5px 0; color: #999999;">Это автоматическое письмо, отвечать на него не нужно</p>
            <p style="margin: 5px 0; color: #999999;">Вопросы? Пишите: ${process.env.EMAIL_FROM}</p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

}

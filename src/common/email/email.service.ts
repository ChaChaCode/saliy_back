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
        <div style="margin: 8px 0; font-size: 13px; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between;">
            <span>ТОВАР ${index + 1}</span>
            <span style="font-weight: 600;">${(item.price * item.quantity).toFixed(2)} ₽</span>
          </div>
          <div style="color: #666; font-size: 12px; margin-top: 2px;">
            ${item.name}
          </div>
          <div style="color: #666; font-size: 12px;">
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
        <div style="font-family: 'Courier New', Courier, monospace; max-width: 480px; margin: 40px auto; padding: 0; background: #f5f5f5;">
          <!-- Чек -->
          <div style="background: white; margin: 0 auto; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <!-- Зубчатый верхний край -->
            <div style="height: 12px; background: linear-gradient(135deg, white 5px, transparent 0), linear-gradient(225deg, white 5px, transparent 0); background-size: 12px 12px; background-position: 0 0, 6px 0; background-repeat: repeat-x;"></div>

            <!-- Контент чека -->
            <div style="padding: 30px 40px;">
              <!-- Заголовок магазина -->
              <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 18px; font-weight: bold; letter-spacing: 4px;">SALIY CLOTHES</div>
                <div style="font-size: 11px; color: #666; margin-top: 5px; letter-spacing: 1px;">ОНЛАЙН МАГАЗИН</div>
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #ccc; margin: 15px 0;"></div>

              <!-- RECEIPT -->
              <div style="text-align: center; margin: 15px 0; font-size: 16px; font-weight: bold; letter-spacing: 2px;">
                *** ЧЕК ***
              </div>

              <!-- Дата и время -->
              <div style="text-align: center; font-size: 11px; color: #666; margin-bottom: 15px;">
                <div>ЗАКАЗ #${orderData.orderNumber}</div>
                <div style="margin-top: 3px;">${currentDate} - ${currentTime}</div>
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
              <div style="font-size: 13px; line-height: 1.8;">
                <div style="display: flex; justify-content: space-between;">
                  <span>ТОВАРЫ</span>
                  <span>${orderData.subtotal.toFixed(2)} ₽</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>ДОСТАВКА</span>
                  <span>${orderData.deliveryPrice.toFixed(2)} ₽</span>
                </div>
                <div style="border-top: 2px dotted #ccc; margin: 10px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px;">
                  <span>ИТОГО</span>
                  <span>${orderData.total.toFixed(2)} ₽</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                  <span>НАЛИЧНЫЕ</span>
                  <span>${orderData.total.toFixed(2)} ₽</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>СДАЧА</span>
                  <span>0.00 ₽</span>
                </div>
              </div>

              <!-- Пунктирная линия -->
              <div style="border-top: 2px dotted #ccc; margin: 15px 0;"></div>

              ${
                orderData.paymentUrl
                  ? `
              <!-- Кнопка оплаты -->
              <div style="text-align: center; margin: 20px 0;">
                <a href="${orderData.paymentUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 1px; border: 2px solid #000;">
                  ОПЛАТИТЬ ЗАКАЗ
                </a>
              </div>

              <div style="border-top: 2px dotted #ccc; margin: 15px 0;"></div>
              `
                  : ''
              }

              <!-- Благодарность -->
              <div style="text-align: center; margin: 20px 0; font-size: 12px; letter-spacing: 1px;">
                СПАСИБО ЗА ПОКУПКУ!
              </div>

              <!-- Штрих-код (имитация) -->
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 5px, transparent 5px, transparent 8px); height: 50px; width: 200px;"></div>
                <div style="font-size: 10px; margin-top: 5px; letter-spacing: 2px;">${orderData.orderNumber}</div>
              </div>
            </div>

            <!-- Зубчатый нижний край -->
            <div style="height: 12px; background: linear-gradient(135deg, transparent 5px, white 0), linear-gradient(225deg, transparent 5px, white 0); background-size: 12px 12px; background-position: 0 0, 6px 0; background-repeat: repeat-x;"></div>
          </div>

          <!-- Информация под чеком -->
          <div style="text-align: center; margin-top: 30px; padding: 0 20px; color: #999; font-size: 11px; font-family: Arial, sans-serif;">
            <p style="margin: 5px 0;">Это автоматическое письмо, отвечать на него не нужно</p>
            <p style="margin: 5px 0;">Вопросы? Пишите: ${process.env.EMAIL_FROM}</p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

}

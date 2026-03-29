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
   * Отправить email с подтверждением заказа
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
    const itemsHtml = orderData.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name} (${item.size})</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${(item.price * item.quantity).toFixed(2)} ₽</td>
        </tr>
      `,
      )
      .join('');

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Заказ #${orderData.orderNumber} оформлен - Saliy Clothes`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #000; font-size: 28px; margin: 0;">SALIY</h1>
            <p style="color: #666; margin-top: 5px;">Спасибо за ваш заказ!</p>
          </div>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h2 style="margin-top: 0; color: #333;">Заказ #${orderData.orderNumber}</h2>
            <p style="color: #666; margin: 5px 0;">Здравствуйте, ${orderData.firstName}!</p>
            <p style="color: #666; margin: 5px 0;">Ваш заказ успешно оформлен и ожидает оплаты.</p>
          </div>

          <h3 style="color: #333; margin-bottom: 15px;">Состав заказа:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f4f4f4;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Товар</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Кол-во</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; margin-top: 20px;">
            <p style="margin: 5px 0; color: #666;">Товары: <strong>${orderData.subtotal.toFixed(2)} ₽</strong></p>
            <p style="margin: 5px 0; color: #666;">Доставка: <strong>${orderData.deliveryPrice.toFixed(2)} ₽</strong></p>
            <p style="margin: 15px 0 0 0; font-size: 20px; color: #000;">Итого: <strong>${orderData.total.toFixed(2)} ₽</strong></p>
          </div>

          ${
            orderData.paymentUrl
              ? `
          <div style="text-align: center; margin-top: 40px;">
            <a href="${orderData.paymentUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
              Оплатить заказ
            </a>
            <p style="color: #999; font-size: 12px; margin-top: 15px;">Или скопируйте ссылку: ${orderData.paymentUrl}</p>
          </div>
          `
              : ''
          }

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>Если у вас есть вопросы, свяжитесь с нами:</p>
            <p>Email: ${process.env.EMAIL_FROM}</p>
            <p style="margin-top: 20px;">С уважением,<br/>Команда SALIY</p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Отправить уведомление об успешной оплате
   */
  async sendPaymentSuccess(
    email: string,
    orderNumber: string,
    firstName: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Оплата заказа #${orderNumber} подтверждена - Saliy Clothes`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #000; font-size: 28px; margin: 0;">SALIY</h1>
            <div style="font-size: 48px; margin: 20px 0;">✓</div>
            <h2 style="color: #4CAF50; margin: 0;">Оплата получена!</h2>
          </div>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p style="color: #666; margin: 5px 0;">Здравствуйте, ${firstName}!</p>
            <p style="color: #666; margin: 15px 0;">Оплата по заказу <strong>#${orderNumber}</strong> успешно получена.</p>
            <p style="color: #666; margin: 15px 0;">Мы начали подготовку вашего заказа к отправке. О статусе доставки мы сообщим дополнительно.</p>
          </div>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>С уважением,<br/>Команда SALIY</p>
          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

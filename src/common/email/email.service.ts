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
}

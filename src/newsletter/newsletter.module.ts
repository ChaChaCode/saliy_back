import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { AdminNewsletterController } from '../admin/newsletter/admin-newsletter.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_ADMIN_SECRET || 'admin-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [NewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}

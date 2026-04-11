import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}

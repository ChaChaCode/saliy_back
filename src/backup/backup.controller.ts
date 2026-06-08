import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { BackupService } from './backup.service';

/**
 * Ручной запуск бэкапа БД администратором.
 * POST /api/admin/backup/run — защищён AdminGuard (только авторизованные админы).
 */
@Controller('admin/backup')
@UseGuards(AdminGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('run')
  async run() {
    const result = await this.backupService.runBackup('manual');
    return {
      ok: result.ok,
      sizeMb: result.sizeMb,
      error: result.error,
    };
  }
}

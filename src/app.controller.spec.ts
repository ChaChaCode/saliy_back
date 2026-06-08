import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status with status ok', () => {
      const result = appController.getRoot();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('saliy-api');
      expect(typeof result.uptime).toBe('number');
    });
  });
});

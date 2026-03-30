import { Module, Global } from '@nestjs/common';
import { SimpleCacheService } from './simple-cache.service';

@Global()
@Module({
  providers: [SimpleCacheService],
  exports: [SimpleCacheService],
})
export class CacheModule {}

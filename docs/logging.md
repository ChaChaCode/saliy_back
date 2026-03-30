# Логирование (Winston)

Проект использует [Winston](https://github.com/winstonjs/winston) через [nest-winston](https://github.com/gremo/nest-winston) для логирования.

## Конфигурация

Конфигурация логгера находится в `src/common/logger/winston.config.ts`.

### Режим разработки (NODE_ENV !== 'production')

- **Уровень логирования:** `debug`
- **Транспорты:** Console (с цветами и форматированием)
- **Формат:** Nest-like формат с timestamp и цветным выводом

### Режим продакшена (NODE_ENV === 'production')

- **Уровень логирования:** `info`
- **Транспорты:**
  - Console (JSON формат)
  - Daily Rotate File - все логи (`logs/application-%DATE%.log`)
    - Максимальный размер файла: 20MB
    - Хранение: 14 дней
  - Daily Rotate File - только ошибки (`logs/error-%DATE%.log`)
    - Максимальный размер файла: 20MB
    - Хранение: 30 дней

## Использование

### Рекомендуемый способ - через стандартный NestJS Logger

Самый простой и рекомендуемый способ - использовать встроенный `Logger` из `@nestjs/common`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  someMethod() {
    this.logger.log('Информационное сообщение');
    this.logger.error('Ошибка', stackTrace);
    this.logger.warn('Предупреждение');
    this.logger.debug('Отладочная информация');
    this.logger.verbose('Детальная информация');
  }
}
```

Этот Logger автоматически использует Winston, так как мы настроили `app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))` в `main.ts`.

### Через dependency injection (альтернативный способ)

```typescript
import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class MyService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  someMethod() {
    this.logger.log('Информационное сообщение', 'MyService');
  }
}
```

### Прямой доступ к Winston Logger

Если нужен прямой доступ к winston API:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class MyService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  someMethod() {
    this.logger.info('Winston native API');
  }
}
```

## Уровни логирования

От наименее важного к наиболее важному:

1. **verbose** - Очень детальная информация
2. **debug** - Отладочная информация (только в dev режиме)
3. **log** - Общая информация
4. **warn** - Предупреждения
5. **error** - Ошибки

## Структура логов в продакшене

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "info",
  "context": "ServiceName",
  "message": "Сообщение",
  "ms": "+2ms"
}
```

## Ротация файлов

Файлы логов автоматически ротируются:
- При достижении максимального размера (20MB)
- Каждый день (новый файл с датой в имени)
- Старые файлы автоматически удаляются (application - 14 дней, error - 30 дней)

## Папка с логами

Логи сохраняются в папку `logs/` в корне проекта.

**Важно:** Папка `logs/` добавлена в `.gitignore` и не попадает в репозиторий.

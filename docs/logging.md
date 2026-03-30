# Логирование (Winston)

Проект использует [Winston](https://github.com/winstonjs/winston) через [nest-winston](https://github.com/gremo/nest-winston) для логирования.

## Конфигурация

Конфигурация логгера находится в `src/common/logger/winston.config.ts`.

### Переменные окружения

- **LOG_PRETTY** - управляет форматом консольного вывода
  - `true` - красивый цветной формат с именем приложения и PID
  - `false` или не установлена - JSON формат

- **NODE_ENV** - определяет окружение
  - `production` - включает файловые логи и уровень `info`
  - любое другое значение - уровень `debug`, без файловых логов

### Формат логов

#### Красивый формат (LOG_PRETTY=true)

```
[SaliyShop] 5892 2026-03-30 18:44:55     LOG [NestFactory] Starting Nest application... +0ms
[SaliyShop] 5892 2026-03-30 18:44:55     LOG [RouterExplorer] Mapped {/api, GET} route +1ms
```

- Цветной вывод
- Имя приложения: `[SaliyShop]`
- PID процесса
- Timestamp
- Контекст и сообщение
- Время с предыдущего лога

#### JSON формат (LOG_PRETTY=false)

```json
{"level":"info","message":"Starting Nest application...","context":"NestFactory","timestamp":"2026-03-30T13:48:35.745Z"}
{"level":"info","message":"Mapped {/api, GET} route","context":"RouterExplorer","timestamp":"2026-03-30T13:48:35.749Z"}
```

- Подходит для ELK, Datadog, CloudWatch
- Легко парсится и индексируется

### Файловые логи (NODE_ENV=production)

В production окружении автоматически создаются файловые логи:

- **Все логи:** `logs/application-%DATE%.log`
  - Максимальный размер файла: 20MB
  - Хранение: 14 дней

- **Только ошибки:** `logs/error-%DATE%.log`
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

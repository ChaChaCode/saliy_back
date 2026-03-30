import { utilities as nestWinston } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Формат для консоли (с цветами в dev)
const consoleFormat = isDevelopment
  ? winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.ms(),
      nestWinston.format.nestLike('SaliyShop', {
        colors: true,
        prettyPrint: true,
        processId: true,
        appName: true,
      }),
    )
  : winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    );

// Формат для файлов (всегда JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

// Транспорты
const transports: winston.transport[] = [
  // Консоль
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// В продакшене добавляем файловые транспорты
if (!isDevelopment) {
  // Все логи (с ротацией)
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),
  );

  // Только ошибки (с ротацией)
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),
  );
}

export const winstonConfig = {
  transports,
  level: isDevelopment ? 'debug' : 'info',
  exitOnError: false,
};

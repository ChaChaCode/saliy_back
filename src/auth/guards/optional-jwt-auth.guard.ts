import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard который позволяет запросы и с токеном, и без токена
 * Если токен есть - валидирует и добавляет req.user
 * Если токена нет - пропускает запрос (req.user будет undefined)
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Не выбрасываем ошибку, если пользователь не авторизован
    // Просто возвращаем user (который может быть null/undefined)
    return user;
  }
}

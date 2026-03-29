import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Проверяем что пользователь авторизован и является админом
    // TODO: Добавить проверку role когда будет реализовано
    // return user && user.role === 'ADMIN';

    // Временно: проверяем что пользователь авторизован
    return !!user;
  }
}

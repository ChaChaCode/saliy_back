import { Resolver, Query, Context } from '@nestjs/graphql';
import { UseGuards, NotFoundException } from '@nestjs/common';
import { User } from './models/user.model';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly authService: AuthService) {}

  /**
   * Получить профиль текущего пользователя
   */
  @Query(() => User, { name: 'me' })
  @UseGuards(GqlAuthGuard)
  async getMe(@Context() context: any): Promise<User> {
    const userId = context.req.user.id;
    const user = await this.authService.validateUser(userId);

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
  }
}

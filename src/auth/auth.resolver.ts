import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { AuthResponse, MessageResponse } from './entities/auth-response.entity';
import { SendCodeInput } from './dto/send-code.input';
import { VerifyCodeInput } from './dto/verify-code.input';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

interface GraphQLContext {
  req: Request;
  res: Response;
}

@Resolver(() => User)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => MessageResponse)
  async sendCode(@Args('input') input: SendCodeInput): Promise<MessageResponse> {
    await this.authService.sendVerificationCode(input.email);
    return { message: 'Код отправлен на email' };
  }

  @Mutation(() => AuthResponse)
  async verifyCode(
    @Args('input') input: VerifyCodeInput,
    @Context() context: GraphQLContext,
  ): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.authService.verifyCode(
      input.email,
      input.code,
    );

    // Устанавливаем refresh token в httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    context.res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // Всегда true (для sameSite: 'none' обязательно)
      sameSite: isProduction ? 'lax' : 'none', // 'none' в dev для cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      path: '/',
    });

    return {
      accessToken,
      message: 'Успешная авторизация',
    };
  }

  @Mutation(() => AuthResponse)
  async refreshToken(@Context() context: GraphQLContext): Promise<AuthResponse> {
    const refreshToken = context.req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token не найден');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshTokens(refreshToken);

    // Обновляем refresh token в cookie
    const isProduction = process.env.NODE_ENV === 'production';
    context.res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true, // Всегда true (для sameSite: 'none' обязательно)
      sameSite: isProduction ? 'lax' : 'none', // 'none' в dev для cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      accessToken,
      message: 'Токен обновлен',
    };
  }

  @Mutation(() => MessageResponse)
  async logout(@Context() context: GraphQLContext): Promise<MessageResponse> {
    const refreshToken = context.req.cookies?.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Удаляем cookie
    context.res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Выход выполнен' };
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: User): Promise<User> {
    return user;
  }
}

import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => String)
  async signUp(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<string> {
    const result = await this.authService.signUp(email, password);
    return result.success ? 'User registered successfully' : 'Registration failed';
  }

  @Mutation(() => String)
  async signIn(
    @Args('email') email: string,
    @Args('password') password: string,
    @Context() context: any,
  ): Promise<string> {
    const result = await this.authService.signIn(email, password);
    // Set session cookie
    if (result.session) {
      context.res.cookie('better-auth.session_token', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }
    return result.success ? 'Signed in successfully' : 'Sign in failed';
  }

  @Mutation(() => String)
  async signOut(@Context() context: any): Promise<string> {
    context.res.clearCookie('better-auth.session_token');
    return 'Signed out successfully';
  }
}


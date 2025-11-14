import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject('BETTER_AUTH') private auth: any,
    private userService: UserService,
  ) {}

  async signUp(email: string, password: string) {
    try {
      const result = await this.auth.api.signUpEmail({
        body: { email, password },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      // User is stored by Better-Auth, ensure it's synced to our MongoDB schema
      const user = await this.userService.findByEmail(email);
      if (!user) {
        await this.userService.create(email, password);
      }

      return { success: true, user: result.data?.user };
    } catch (error) {
      throw new Error(`Sign up failed: ${error.message}`);
    }
  }

  async signIn(email: string, password: string) {
    try {
      const result = await this.auth.api.signInEmail({
        body: { email, password },
      });

      if (result.error) {
        throw new UnauthorizedException(result.error.message);
      }

      // Update last sign in time in our MongoDB
      await this.userService.updateLastSignIn(email);

      return { success: true, session: result.data?.session };
    } catch (error) {
      throw new UnauthorizedException(`Sign in failed: ${error.message}`);
    }
  }

  async getSession(req: any) {
    try {
      return await this.auth.api.getSession({ headers: req.headers });
    } catch (error) {
      return null;
    }
  }
}


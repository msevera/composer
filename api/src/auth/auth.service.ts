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
      // Better-Auth requires the URL to include the basePath (/api/auth)
      // Get the base URL from the request
      const protocol = req.protocol || 'http';
      const host = req.get?.('host') || req.headers.host || 'localhost:4000';
      const baseURL = `${protocol}://${host}`;
      
      // Construct the correct URL with basePath
      const url = `${baseURL}/api/auth/get-session`;
      
      // Convert Express headers to Headers object for Better-Auth
      const headers = new Headers();
      Object.keys(req.headers).forEach((key) => {
        const value = req.headers[key];
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      });
      
      // console.log('Getting session from URL:', url);
      // console.log('Cookies in headers:', headers.get('cookie'));
      
      // Create a Request object that Better-Auth expects
      const fetchRequest = new Request(url, {
        method: 'GET',
        headers: headers,
      });
      
      // Call Better-Auth's handler directly for get-session
      const response = await this.auth.handler(fetchRequest);
      
      //console.log('Session response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        return { data: data };
      }
      
      const errorText = await response.text();
      console.log('Session response error:', errorText);
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }
}


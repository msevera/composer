import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Handle GraphQL context
    let request: any;
    
    try {
      // Try to get GraphQL context first
      const gqlContext = GqlExecutionContext.create(context);
      request = gqlContext.getContext().req;
      console.log('GraphQL context found, request:', !!request);
    } catch (error) {
      // Fallback to HTTP context
      request = context.switchToHttp().getRequest();
      console.log('Using HTTP context, request:', !!request);
    }

    if (!request) {
      console.error('No request found in context');
      throw new ForbiddenException('Forbidden resource');
    }

    // console.log('Getting session, headers:', Object.keys(request.headers || {}));
    const session = await this.authService.getSession(request);
    // console.log('Session result:', session ? 'exists' : 'null', session?.data ? 'has data' : 'no data', session?.data?.user ? 'has user' : 'no user');

    if (session?.data?.user) {
      request.user = session.data.user;
      // console.log('Authentication successful, user ID:', request.user.id);
      return true;
    }

    console.error('Authentication failed - no user in session');
    throw new ForbiddenException('Forbidden resource');
  }
}


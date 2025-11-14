import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request as ExpressRequest, Response, NextFunction } from 'express';

// Request is available in Node.js 18+ as a global
// We'll use the global Request type for Fetch API
declare const Request: {
  new (input: string | URL, init?: RequestInit): globalThis.Request;
};

// Request is available in Node.js 18+, but we'll use a fallback if needed
const createFetchRequest = (url: string, options: any): globalThis.Request => {
  if (typeof globalThis.Request !== 'undefined') {
    return new globalThis.Request(url, options);
  }
  // Fallback for older Node.js versions - would need undici or node-fetch
  throw new Error('Request constructor not available. Node.js 18+ required or install undici.');
};

@Injectable()
export class BetterAuthMiddleware implements NestMiddleware {
  constructor(@Inject('BETTER_AUTH') private auth: any) {}

  async use(req: ExpressRequest, res: Response, next: NextFunction) {
    // Check if this is a Better-Auth route
    if (req.path.startsWith('/api/auth') || req.originalUrl.startsWith('/api/auth')) {
      console.log('Better-Auth middleware triggered for:', req.method, req.originalUrl);
      
      // Use Better-Auth's handler if available
      if (!this.auth) {
        console.error('Better-Auth instance is not available');
        return next();
      }

      if (!this.auth.handler) {
        console.error('Better-Auth handler is not available. Auth object keys:', Object.keys(this.auth || {}));
        return next();
      }

      console.log('Calling Better-Auth handler...');

      try {
        // Convert Express request to Fetch API Request
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        
        // Get body for POST/PUT/PATCH requests
        let body: string | undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
          if (req.body) {
            body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          }
        }

        const fetchRequest = createFetchRequest(url, {
          method: req.method,
          headers: req.headers as any,
          body: body,
        });

        // Call Better-Auth handler
        const fetchResponse = await this.auth.handler(fetchRequest);

        // Convert Fetch API Response to Express response
        res.status(fetchResponse.status);
        
        // Copy headers
        fetchResponse.headers.forEach((value, key) => {
          // Skip content-length as Express will set it
          if (key.toLowerCase() !== 'content-length') {
            res.setHeader(key, value);
          }
        });

        // Send response body
        const responseBody = await fetchResponse.text();
        res.send(responseBody);
        // Don't call next() after sending response
        return;
      } catch (error) {
        console.error('Better-Auth handler error:', error);
        return next(error);
      }
    }
    next();
  }
}


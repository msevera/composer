import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:4000/api/auth',
  fetchOptions: {
    credentials: 'include',
    onResponse: (ctx) => {
      console.log('onResponse', Object.fromEntries(ctx.response.headers.entries()))
      const authToken = ctx.response.headers.get("set-auth-token") // get the token from the response headers
      // Store the token securely (e.g., in localStorage)
      console.log("onResponse authToken", authToken);
    },

    onSuccess: (ctx) => {
      console.log('onSuccess', Object.fromEntries(ctx.response.headers.entries()))
      const authToken = ctx.response.headers.get("set-auth-token") // get the token from the response headers
      // Store the token securely (e.g., in localStorage)
      console.log("onSuccess authToken", authToken);
    }
  },

});


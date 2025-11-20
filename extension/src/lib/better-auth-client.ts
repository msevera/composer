import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.PLASMO_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:4000/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
});


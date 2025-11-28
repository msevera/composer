import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from "better-auth/client/plugins";


console.log('inferAdditionalFields', inferAdditionalFields({
  user: {
    email: {
      type: "string"
    }
  }
}))

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({
    account: {
      email: {
        type: "string"
      }
    }
  })],
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:4000/api/auth',
  fetchOptions: {
    credentials: 'include',   
  },

});


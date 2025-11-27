import { createAuthClient } from "better-auth/react";
import { sendToBackground } from "@plasmohq/messaging"
import { normalizeHeaders } from './utils';
import { jwtClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  // plugins: [
  //   jwtClient()
  // ],
  baseURL: process.env.PLASMO_PUBLIC_BETTER_AUTH_URL,
  fetchOptions: {
    onSuccess: (ctx) => {
      // const authToken = ctx.response.headers.get("set-auth-token") // get the token from the response headers
      // console.log("ctx", ctx.response);
      // // Store the token securely (e.g., in localStorage)
      // if (authToken) {
      //   console.log("bearer_token", authToken);
      // }
    },
    customFetchImpl: async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
      const inputUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url)
      const url = inputUrl.startsWith('http')
        ? inputUrl
        : `${process.env.PLASMO_PUBLIC_BETTER_AUTH_URL}${inputUrl.startsWith('/') ? '' : '/'}${inputUrl}`

      const method = init?.method
      const headers = normalizeHeaders(init?.headers)
      const body = typeof init?.body === 'string' ? init.body : undefined

      const resp = await sendToBackground({
        name: "fetch",
        body: {
          url,
          method,
          headers,
          body,
          credentials: 'include',
        },
        extensionId: process.env.PLASMO_PUBLIC_CHROME_EXTENSION_ID
      })

      console.log("resp", resp.headers);

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: new Headers(resp.headers),
      })
    },
  }
});


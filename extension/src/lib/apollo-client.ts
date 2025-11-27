import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { sendToBackground } from '@plasmohq/messaging';
import { normalizeHeaders } from './utils';
import { authClient } from './better-auth-client';

const httpLink = new HttpLink({
  uri: process.env.PLASMO_PUBLIC_API_URL,
  // fetch: async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
  //   const inputUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url)
  //   const url = inputUrl.startsWith('http')
  //     ? inputUrl
  //     : `${process.env.PLASMO_PUBLIC_BETTER_AUTH_URL}${inputUrl.startsWith('/') ? '' : '/'}${inputUrl}`

  //   const method = init?.method
  //   const headers = normalizeHeaders(init?.headers)
  //   const body = typeof init?.body === 'string' ? init.body : undefined

  //   const resp = await sendToBackground({
  //     name: "fetch",
  //     body: {
  //       url,
  //       method,
  //       headers,
  //       body,
  //       credentials: 'include',
  //     },
  //     extensionId: process.env.PLASMO_PUBLIC_CHROME_EXTENSION_ID
  //   })

  //   return new Response(resp.body, {
  //     status: resp.status,
  //     statusText: resp.statusText,
  //     headers: new Headers(resp.headers),
  //   })
  // },
});

const authLink = setContext(async (_, { headers }) => {
  const session = await authClient.getSession()
  return ({

    headers: {
      ...headers,
      Authorization: `Bearer ${session?.data?.session?.token}`
    },
  })
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});


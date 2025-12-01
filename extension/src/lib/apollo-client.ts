import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { authClient } from './better-auth-client';

const httpLink = new HttpLink({
  uri: process.env.PLASMO_PUBLIC_API_URL,
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


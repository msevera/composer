import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core/index.js';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/graphql';

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: API_URL,
      credentials: 'include',
      fetchOptions: {
        mode: 'cors',
      },
    }),
    cache: new InMemoryCache(),
  });
}


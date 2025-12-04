import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL,
  credentials: 'include',
});

const authLink = new SetContextLink(async (prevContext) => {
  return {
    headers: {
      ...prevContext.headers,     
    },
  };
});

const link = ApolloLink.from([
  authLink,
  httpLink,
]);

export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});


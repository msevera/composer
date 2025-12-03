import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { authClient } from './better-auth-client';

const httpLink = new HttpLink({
  uri: `${process.env.PLASMO_PUBLIC_API_URL}/graphql`,
});

const authLink = new SetContextLink(async (prevContext) => {
  const session = await authClient.getSession()
  return {
    headers: {
      ...prevContext.headers,
      Authorization: `Bearer ${session?.data?.session?.token}`
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


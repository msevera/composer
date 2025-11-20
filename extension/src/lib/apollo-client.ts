import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

const API_URL =
  process.env.PLASMO_PUBLIC_API_URL ??
  "http://localhost:4000/graphql";

const httpLink = new HttpLink({
  uri: API_URL,
  credentials: "include",
});

const authLink = setContext((_, { headers }) => ({
  headers: {
    ...headers,
  },
}));

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});


import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloProvider } from '@apollo/client/react/index.js';
import './index.css';
import App from './App.tsx';
import { createApolloClient } from './lib/apolloClient';

const client = createApolloClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
    <App />
    </ApolloProvider>
  </StrictMode>,
);

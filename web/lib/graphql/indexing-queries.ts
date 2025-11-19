import { gql } from '@apollo/client';

export const GET_ALL_INDEXING_STATUSES = gql`
  query GetAllIndexingStatuses {
    getAllIndexingStatuses {
      platform
      status
      totalIndexed
      lastSyncedAt
      errorMessage
    }
  }
`;

export const GET_INDEXING_STATUS = gql`
  query GetIndexingStatus($platform: String!) {
    getIndexingStatus(platform: $platform) {
      platform
      status
      totalIndexed
      lastSyncedAt
      errorMessage
    }
  }
`;

export const START_INDEXING = gql`
  mutation StartIndexing($platform: String!) {
    startIndexing(platform: $platform)
  }
`;

export const TRIGGER_SYNC = gql`
  mutation TriggerSync($platform: String!) {
    triggerSync(platform: $platform)
  }
`;

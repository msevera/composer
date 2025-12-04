export type User = {
  id?: string;
  email?: string;
  name?: string;
  sendProductUpdates?: boolean;
  onboardingCompleted?: boolean;
  maxDraftsAllowed?: number;
  draftsUsed?: number;
  lastSignIn?: string;
  createdAt?: string;
  updatedAt?: string;
};


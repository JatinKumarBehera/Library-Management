export interface UserProfile {
  uid: string;
  email: string;
  createdAt: string;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  genre?: string;
  tags?: string[];
  rating?: number;
  image?: string;
  description?: string;
  publicationYear?: string;
  isBorrowed?: boolean;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

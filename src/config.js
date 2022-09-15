export const config = {
  IsProductEnv: process.env.REACT_APP_PUBLIC_ENV === 'production',
  DIDResolverUrl: process.env.REACT_APP_PUBLIC_ENV === 'production' ? 'mainnet' : 'testnet',
  nodeRegistryAddress: process.env.REACT_APP_NODE_REGISTRY_ADDRESS || '',
  serverUrl: 'https://service.hivehub.xyz',
  ApplicationDID: 'did:elastos:ik3ngW1tRxzTtwRstgkCWuv4SmUQ6nGcML',
  GitHubRepo: 'https://github.com/elastos-trinity/HiveHub'
};

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APPID || '',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || ''
};

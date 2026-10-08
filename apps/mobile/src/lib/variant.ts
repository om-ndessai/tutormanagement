import Constants from 'expo-constants';

/** Which build this is (app.config.ts): development, e2e, or production. */
export const APP_VARIANT = (Constants.expoConfig?.extra?.variant ?? 'development') as
  'development' | 'e2e' | 'production';

/** Developer-only screens and the developer sign-in exist outside production only. */
export const DEV_TOOLS = APP_VARIANT !== 'production';

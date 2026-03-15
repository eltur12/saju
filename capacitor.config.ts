import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saju.fortune',
  appName: '사주 운세',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Preferences: {
      group: 'CapacitorStorage',
    },
  },
};

export default config;

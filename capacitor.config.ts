import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saju.fortune',
  appName: '하루온도',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Preferences: {
      group: 'CapacitorStorage',
    },
    AdMob: {
      appId: {
        android: 'ca-app-pub-6572674549840800~1714269434',
      },
    },
  },
};

export default config;

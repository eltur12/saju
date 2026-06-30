const TEST_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const PROD_REWARDED_AD_UNIT_ID = 'ca-app-pub-6572674549840800/3384398153';

// .env.development → VITE_USE_TEST_ADS=true
// .env.production  → VITE_USE_TEST_ADS=false
export const USE_TEST_ADS = import.meta.env.VITE_USE_TEST_ADS === 'true';

export const AD_CONFIG = {
  rewardedAdUnitId: USE_TEST_ADS
    ? TEST_REWARDED_AD_UNIT_ID
    : PROD_REWARDED_AD_UNIT_ID,
};

import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import { AD_CONFIG } from './adMobConfig';

export async function initAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.initialize();
  } catch (e) {
    console.warn('[AdMob] 초기화 실패:', e);
  }
}

/**
 * 리워드 광고를 로드하고 표시합니다.
 * 보상 완료 시 true, 로드 실패 / 표시 실패 / 사용자 조기 종료 시 false 반환.
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // 웹(개발) 환경: 광고 없이 보상 완료로 처리
    return true;
  }

  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_CONFIG.rewardedAdUnitId });
  } catch (e) {
    console.warn('[AdMob] 광고 로드 실패:', e);
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let rewarded = false;
    const handles: PluginListenerHandle[] = [];

    const cleanup = () => {
      for (const h of handles) {
        try { h.remove(); } catch {}
      }
    };

    handles.push(
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      })
    );
    handles.push(
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        cleanup();
        resolve(rewarded);
      })
    );
    handles.push(
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => {
        console.warn('[AdMob] 광고 표시 실패:', err);
        cleanup();
        resolve(false);
      })
    );

    AdMob.showRewardVideoAd().catch((e) => {
      console.warn('[AdMob] showRewardVideoAd 오류:', e);
      cleanup();
      resolve(false);
    });
  });
}

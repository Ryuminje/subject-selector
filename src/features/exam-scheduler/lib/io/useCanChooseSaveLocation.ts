'use client';

import { useSyncExternalStore } from 'react';
import { canChooseSaveLocation } from './saveFile';

/**
 * 브라우저 기능은 한 번 정해지면 바뀌지 않으므로 구독할 것이 없습니다.
 * 모듈 밖에 두어 매 렌더마다 새 함수가 만들어지지 않게 합니다.
 */
const subscribe = () => () => {};

const getSnapshot = () => canChooseSaveLocation();

/** 서버에는 `window`가 없으니 항상 '못 고른다'로 봅니다. */
const getServerSnapshot = () => false;

/**
 * 저장 위치를 고를 수 있는 브라우저인지 알려줍니다.
 *
 * 렌더 중에 `canChooseSaveLocation()`을 그냥 부르면 서버(false)와 브라우저(true)의
 * 결과가 달라 하이드레이션이 어긋납니다. `useSyncExternalStore`는 서버용 값과
 * 클라이언트용 값을 따로 받아 이 문제를 React가 알아서 처리하게 해 줍니다.
 */
export function useCanChooseSaveLocation(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

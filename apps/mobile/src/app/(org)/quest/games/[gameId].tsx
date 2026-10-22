import { useLocalSearchParams } from 'expo-router';

import { GameScreen } from '@/features/quest/game-screen';

/** One Quest game (Phase 46), full screen outside the tabs: its lobby, its play, its results. */
export default function QuestGameRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  return <GameScreen gameId={gameId ?? ''} />;
}

import { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { parseTileCode, tileCode, tileGameRequest, tileWords } from '@tmi/shared';

import { useStartQuest } from '@/features/play/play-home';
import { useAuth } from '@/providers/auth-provider';
import { GuestAssessment } from './guest-assessment';
import { GuestQuest } from './guest-quest';
import { readQuestState } from './guest-store';

/**
 * Phase 63 (P14): `/play/<code>` -- a tile in one tap from a link, a QR code or a shared result. A
 * guest plays it on the device while it is open to guests; a member's tap starts it as a game in their
 * space; anything else lands on the home.
 */
export function PlayLink() {
  const { code = '' } = useParams();
  const { status, config } = useAuth();
  const shape = parseTileCode(code);
  // The config may arrive after the session's 401: wait for it before choosing.
  if (status === 'loading' || (status === 'unauthenticated' && config === null)) return null;
  if (!shape) return <Navigate to="/" replace />;
  const tile = config?.guest?.tiles.find((t) => t.code === tileCode(shape) && !t.locked);
  // P13: someone who signed up mid-quest finishes the quest they were playing, on the same page.
  const playing = readQuestState(tileCode(shape));
  if (status === 'authenticated' && !(tile && playing && !playing.finished)) {
    return <Navigate to={`/quest/tile/${tileCode(shape)}`} replace />;
  }
  if (!tile) return <Navigate to="/" replace />;
  // P11: an assessment tile is the guest Assessment, on the device.
  if (tile.kind === 'assessment') return <GuestAssessment key={tile.code} tile={tile} />;
  return <GuestQuest key={tile.code} tile={tile} />;
}

/** A member arriving from a tile link: the tile starts as a single player's game in their space. */
export function MemberTileStart() {
  const { code = '' } = useParams();
  const { start } = useStartQuest();
  const started = useRef(false);
  const shape = parseTileCode(code);
  useEffect(() => {
    if (!shape || started.current) return;
    started.current = true;
    void start(tileCode(shape), tileGameRequest(shape));
  }, [shape, start]);
  if (!shape) return <Navigate to="/" replace />;
  return <p className="text-muted-foreground p-6 text-sm">Starting {tileCode(shape)} · {tileWords(shape)}…</p>;
}

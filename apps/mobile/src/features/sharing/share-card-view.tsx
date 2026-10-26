// Ported from apps/web/src/features/sharing/card-image.ts @ 3279506: the card drawn as a view, which
// react-native-view-shot turns into the picture people post.
import { shareHeadline, type ShareCard } from '@tmi/shared';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { SHARE_CARD } from '@/theme/brand-art';
import { radius } from '@/theme/tokens';

/** The card's headline without its level (the level is the big line). */
export function cardSubline(card: ShareCard): string {
  return shareHeadline(card).replace(`${card.level_label} · `, '');
}

/**
 * Phase 56: the card, 1200x630 in shape (the size every site unfurls): the brand and the chosen first
 * name, the level (or "Can you solve this?"), the headline, and a game's marks. Only the server's card
 * and the maker's own first name -- nobody else's.
 */
export const ShareCardView = forwardRef<View, { card: ShareCard; firstName: string | null; brand: string }>(
  function ShareCardView({ card, firstName, brand }, ref) {
    const marks = card.kind === 'game_result' ? card.marks.slice(0, 20) : [];
    const mark = marks.length > 10 ? 14 : 22;
    return (
      <View
        ref={ref}
        collapsable={false}
        testID="share-card"
        accessible
        accessibilityLabel={`${brand} Quest${firstName ? `, ${firstName}` : ''}. ${shareHeadline(card)}`}
        style={{ width: '100%', aspectRatio: 1200 / 630, borderRadius: radius.lg, overflow: 'hidden' }}
      >
        <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="share-card" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={SHARE_CARD.from} />
              <Stop offset="1" stopColor={SHARE_CARD.to} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#share-card)" />
        </Svg>
        <View style={{ flex: 1, paddingHorizontal: '8%', paddingVertical: '6%', justifyContent: 'space-between' }}>
          <Text variant="labelLarge" style={{ color: SHARE_CARD.text, opacity: 0.8 }}>
            {`${brand} Quest${firstName ? ` · ${firstName}` : ''}`}
          </Text>
          <Text variant="headlineSmall" numberOfLines={2} style={{ color: SHARE_CARD.text, fontWeight: '700' }}>
            {card.kind === 'challenge' ? 'Can you solve this?' : card.level_label}
          </Text>
          <Text variant="titleMedium" style={{ color: SHARE_CARD.text, opacity: 0.9 }}>
            {cardSubline(card)}
          </Text>
          {marks.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {marks.map((m, i) => (
                <View
                  key={i}
                  style={{ width: mark, height: mark, borderRadius: 4, backgroundColor: SHARE_CARD[m] }}
                />
              ))}
            </View>
          ) : (
            <View />
          )}
        </View>
      </View>
    );
  },
);

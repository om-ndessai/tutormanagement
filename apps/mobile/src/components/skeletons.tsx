// First-load placeholders shaped like what is coming (ux-audit F-11, immersive-design §9: "the
// skeleton mirrors the real layout"), in place of a spinner and a sentence. Each group is one
// element to a screen reader, announced as loading; the blocks inside are hidden from it. None is
// shaped like an amount, so a Tutoring screen never shows the outline of money.
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useLargeText } from '@/hooks/use-large-text';
import { radius, space } from '@/theme/tokens';
import { Skeleton } from './skeleton';

/** A loading region: one accessible element ("Loading the lesson…", busy). */
export function SkeletonGroup({
  label,
  testID,
  children,
  gap = space.md,
}: {
  label: string;
  testID?: string;
  children: ReactNode;
  gap?: number;
}) {
  return (
    <View
      testID={testID ?? 'state-loading'}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ gap }}
    >
      {children}
    </View>
  );
}

/** A line of text: `width` of the row, at the height of the text it stands for. */
function Line({ width, height = 14 }: { width: `${number}%` | number; height?: number }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: radius.sm }} />;
}

/** A list's first page: `count` cards of the real cards' height. */
export function ListSkeleton({
  label,
  count = 3,
  height = 88,
  testID,
}: {
  label: string;
  count?: number;
  height?: number;
  testID?: string;
}) {
  return (
    <SkeletonGroup label={label} testID={testID}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width="100%" height={height} style={{ borderRadius: radius.lg }} />
      ))}
    </SkeletonGroup>
  );
}

/**
 * Home's first load, section by section: the Tutoring/Finance switch, the Analytics stat cards
 * (one to a row under large text, as the real grid), a lesson card, and the spotlight.
 */
export function DashboardSkeleton({ testID = 'dashboard-loading' }: { testID?: string }) {
  const large = useLargeText();
  const stat = <Skeleton width="100%" height={large ? 96 : 64} style={{ borderRadius: radius.lg }} />;
  const statRow = large ? (
    <View style={{ gap: space.md }}>
      {stat}
      {stat}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ flex: 1 }}>{stat}</View>
      <View style={{ flex: 1 }}>{stat}</View>
    </View>
  );
  return (
    <SkeletonGroup label="Loading your dashboard…" testID={testID} gap={space.lg}>
      <Skeleton width="100%" height={44} style={{ borderRadius: radius.pill }} />
      <View style={{ gap: space.sm }}>
        <Line width="35%" height={18} />
        {statRow}
        {statRow}
      </View>
      <View style={{ gap: space.sm }}>
        <Line width="50%" height={18} />
        <Skeleton width={272} height={150} style={{ borderRadius: radius.lg, alignSelf: 'center' }} />
      </View>
      <View style={{ gap: space.sm }}>
        <Line width="30%" height={18} />
        <Skeleton width="100%" height={120} style={{ borderRadius: radius.lg }} />
      </View>
    </SkeletonGroup>
  );
}

/** A record's first load: its heading, a line under it, then label-and-value rows in a card. */
export function DetailSkeleton({
  label,
  rows = 4,
  testID,
  avatar = false,
}: {
  label: string;
  rows?: number;
  testID?: string;
  /** A person's record leads with their initials. */
  avatar?: boolean;
}) {
  return (
    <SkeletonGroup label={label} testID={testID} gap={space.lg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        {avatar ? <Skeleton width={64} height={64} style={{ borderRadius: 32 }} /> : null}
        <View style={{ flex: 1, gap: space.sm }}>
          <Line width="70%" height={24} />
          <Line width="45%" />
        </View>
      </View>
      <Skeleton width="100%" height={44} style={{ borderRadius: radius.md }} />
      <View style={{ gap: space.md }}>
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={{ gap: space.xs }}>
            <Line width="25%" height={11} />
            <Line width={index % 2 ? '55%' : '80%'} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/** A form sheet waiting for what it edits: field-shaped blocks and the save button's place. */
export function FormSkeleton({
  label,
  fields = 4,
  testID,
}: {
  label: string;
  fields?: number;
  testID?: string;
}) {
  return (
    <SkeletonGroup label={label} testID={testID}>
      <Line width="60%" height={20} />
      {Array.from({ length: fields }, (_, index) => (
        <Skeleton key={index} width="100%" height={56} style={{ borderRadius: radius.sm }} />
      ))}
      <Skeleton width="100%" height={44} style={{ borderRadius: radius.pill }} />
    </SkeletonGroup>
  );
}

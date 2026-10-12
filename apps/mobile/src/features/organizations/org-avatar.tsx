// Ported from apps/web/src/features/organizations/org-avatar.tsx @ 1132322
import { ORG_PALETTE_HEX, brandFromOrganization, type OrganizationBrand } from '@tmi/shared';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { brandLogoUrl } from '@/providers/brand-provider';
import { radius } from '@/theme/tokens';

/**
 * An organization's mark in a list: its uploaded logo, the institute's own artwork for the
 * one organization that wears it, or its initials on its palette colour. The colour is the
 * organization's data (ORG_PALETTE_HEX): a list shows several organizations at once, so the
 * screen's own tokens cannot stand in for each.
 */
export function OrgAvatar({ org, size = 40 }: { org: OrganizationBrand; size?: number }) {
  const url = brandLogoUrl(brandFromOrganization(org));
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: 'white' }} // rules-allow-colour: logo plate
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }
  const initials = org.short_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: ORG_PALETTE_HEX[org.palette],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="labelLarge" style={{ color: 'white' }}>
        {initials}
      </Text>
    </View>
  );
}

// Ported from apps/web/src/features/platform/organization-dialog.tsx (LogoSection) @ 1132322.
// The web's file input becomes the system photo picker; the picture is shrunk and re-encoded as
// PNG or WebP on the phone until it fits in 256 KB (logo-pipeline.ts), then sent as raw bytes.
import { LOGO_KINDS, type LogoKind, type OrganizationListItem } from '@tmi/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Icon, IconButton, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError, apiOrigin } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useRemoveLogo, useUploadLogo } from './api';
import { LogoError, pickLogo } from './logo-pipeline';

function absolute(url: string): string {
  return url.startsWith('http') ? url : `${apiOrigin()}${url}`;
}

export function LogoSection({ organization }: { organization: OrganizationListItem }) {
  const theme = useAppTheme();
  const toast = useToast();
  const upload = useUploadLogo();
  const remove = useRemoveLogo();
  const [preparing, setPreparing] = useState<LogoKind | null>(null);
  const busy = preparing !== null || upload.isPending || remove.isPending;

  async function choose(kind: LogoKind) {
    haptics.selection();
    setPreparing(kind);
    try {
      const logo = await pickLogo(kind);
      if (!logo) return;
      await upload.mutateAsync({ id: organization.id, kind, ...logo });
      haptics.success();
      toast.success('Logo updated.');
    } catch (caught) {
      haptics.error();
      toast.error(
        caught instanceof ApiRequestError
          ? (caught.fieldErrors.logo ?? caught.message)
          : caught instanceof LogoError
            ? caught.message
            : 'Upload failed.',
      );
    } finally {
      setPreparing(null);
    }
  }

  async function removeLogo(kind: LogoKind) {
    haptics.selection();
    try {
      await remove.mutateAsync({ id: organization.id, kind });
      toast.success('Logo removed.');
    } catch (caught) {
      haptics.error();
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not remove the logo.');
    }
  }

  return (
    <Panel title="Logos" testID="platform-logos">
      <View style={{ gap: space.md }}>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          PNG or WebP, at most 256 KB. The mark is square and goes in the browser tab and the sidebar; the
          full logo goes on the sign-in page.
        </Text>
        {LOGO_KINDS.map((kind) => {
          const url = kind === 'mark' ? organization.logo_mark_url : organization.logo_full_url;
          const label = kind === 'mark' ? 'Mark' : 'Full logo';
          return (
            <View
              key={kind}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: radius.md,
                padding: space.md,
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 48,
                  borderRadius: radius.sm,
                  backgroundColor: theme.tokens.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {url ? (
                  <Image
                    testID={`platform-logo-preview-${kind}`}
                    source={{ uri: absolute(url) }}
                    style={{ width: 80, height: 48 }}
                    contentFit="contain"
                    accessibilityLabel={`${label} of ${organization.name}`}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View testID={`platform-logo-empty-${kind}`}>
                    <Icon source="image-plus" size={20} color={theme.tokens.mutedForeground} />
                  </View>
                )}
              </View>
              <Text variant="bodyMedium" style={{ flex: 1 }}>
                {label}
              </Text>
              <Button
                testID={`platform-logo-upload-${kind}`}
                mode="outlined"
                compact
                disabled={busy}
                loading={preparing === kind}
                onPress={() => void choose(kind)}
              >
                {url ? 'Replace' : 'Upload'}
              </Button>
              {url ? (
                <IconButton
                  testID={`platform-logo-remove-${kind}`}
                  icon="trash-can-outline"
                  accessibilityLabel={kind === 'mark' ? 'Remove mark' : 'Remove full logo'}
                  disabled={busy}
                  onPress={() => void removeLogo(kind)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

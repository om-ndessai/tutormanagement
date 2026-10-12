// Ported from apps/web/src/providers/brand-provider.tsx @ 1132322
import { PLATFORM_BRAND, brandFromOrganization, type Brand } from '@tmi/shared';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { apiOrigin } from '@/lib/api-client';
import { useAuth } from './auth-provider';

interface BrandState {
  brand: Brand;
  /** Wears the platform's own identity while the platform console is open. */
  setPlatformMode: (on: boolean) => void;
}

const BrandContext = createContext<BrandState>({ brand: PLATFORM_BRAND, setPlatformMode: () => undefined });

/**
 * Which identity the app is wearing: the organization it is in, or -- before one is chosen,
 * and on the console -- the neutral platform brand. The app is nobody's address, so unlike the
 * web app's sign-in page it never wears an organization before one is entered.
 */
export function BrandProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  const [platformMode, setPlatformMode] = useState(false);
  const brand = platformMode || !organization ? PLATFORM_BRAND : brandFromOrganization(organization);
  return <BrandContext value={{ brand, setPlatformMode }}>{children}</BrandContext>;
}

export function useBrand(): Brand {
  return use(BrandContext).brand;
}

/** Puts the platform's own identity on for as long as the caller is mounted. */
export function usePlatformBrand(): void {
  const { setPlatformMode } = use(BrandContext);
  useEffect(() => {
    setPlatformMode(true);
    return () => setPlatformMode(false);
  }, [setPlatformMode]);
}

/**
 * The brand's logo as an absolute URL, or null to draw the initials mark. Uploaded logos are
 * served by the API at a versioned public path; the institute's built-in artwork too.
 */
export function brandLogoUrl(brand: Brand, kind: 'mark' | 'full' = 'mark'): string | null {
  const path = kind === 'mark' ? brand.logo_mark_url : brand.logo_full_url;
  if (path) return path.startsWith('http') ? path : `${apiOrigin()}${path}`;
  if (brand.builtin_logo === 'institute' && brand.slug) {
    return `${apiOrigin()}/api/organizations/${encodeURIComponent(brand.slug)}/logo/${kind}`;
  }
  return null;
}

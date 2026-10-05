import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ORG_PALETTE_HEX, PLATFORM_BRAND, brandFromOrganization, type Brand } from '@tmi/shared';

import { useAuth } from './auth-provider';

interface BrandState {
  brand: Brand;
  /**
   * False until the Worker has said who the portal is. Nothing that names or
   * pictures an organization may render before then, or the neutral platform
   * mark would flash in front of an organization's own.
   */
  ready: boolean;
  /** Wears the platform's own identity while the platform console is open. */
  setPlatformMode: (on: boolean) => void;
}

const BrandContext = createContext<BrandState>({
  brand: PLATFORM_BRAND,
  ready: false,
  setPlatformMode: () => undefined,
});

/**
 * Which identity the portal is wearing: the organization this tab is in, or
 * -- before one is chosen, and on the sign-in page -- what the Worker's config
 * says (the organization this browser last used, else the neutral platform
 * brand). Data, not a build flag: one build serves every organization, and
 * none can appear as another.
 */
export function BrandProvider({ children }: { children: ReactNode }) {
  const { config, organization, status } = useAuth();
  const [platformMode, setPlatformMode] = useState(false);
  const brand = platformMode
    ? PLATFORM_BRAND
    : organization
      ? brandFromOrganization(organization)
      : (config?.brand ?? PLATFORM_BRAND);

  // The palette is chosen in CSS off this attribute, so every component
  // follows without knowing an organization exists.
  useEffect(() => {
    document.documentElement.dataset.palette = brand.palette;
  }, [brand.palette]);

  /**
   * The head is static HTML, written before anyone knows which organization
   * is being shown, so its name and icon are replaced here -- the two places a
   * person looks first.
   */
  useEffect(() => {
    document.title = brand.short === brand.name ? brand.name : `${brand.short} · ${brand.name}`;

    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', `Tutoring portal for ${brand.name}.`);

    // An uploaded mark, then the institute's own artwork, then the drawn pi
    // mark tinted to the palette. The head cannot read CSS variables, hence
    // the one hex per palette.
    const tile = ORG_PALETTE_HEX[brand.palette];
    const piMark = `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
        `<rect width="48" height="48" rx="13" fill="${tile}"/>` +
        `<g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round">` +
        `<path d="M13 18h22"/><path d="M20 18v14"/>` +
        `<path d="M29 18v10c0 2.6 1.4 4 3.6 4"/></g></svg>`,
    )}`;

    const icon =
      brand.logo_mark_url ?? (brand.builtin_logo === 'institute' ? '/favicon.png' : piMark);
    const touch =
      brand.logo_mark_url ?? (brand.builtin_logo === 'institute' ? '/logo-mark.png' : piMark);

    document.querySelector('link[rel="icon"]')?.setAttribute('href', icon);
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', touch);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tile);
  }, [brand]);

  return (
    <BrandContext.Provider
      value={{ brand, ready: config !== null && status !== 'loading', setPlatformMode }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): Brand {
  return useContext(BrandContext).brand;
}

/** Puts the platform's own identity on for as long as the caller is mounted. */
export function usePlatformBrand(): void {
  const { setPlatformMode } = useContext(BrandContext);
  useEffect(() => {
    setPlatformMode(true);
    return () => setPlatformMode(false);
  }, [setPlatformMode]);
}

/** Whether the portal has said who it is yet. */
export function useBrandReady(): boolean {
  return useContext(BrandContext).ready;
}

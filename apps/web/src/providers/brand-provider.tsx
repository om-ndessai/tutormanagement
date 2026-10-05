import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { resolveBrand, type Brand } from '@tmi/shared';

import { useAuth } from './auth-provider';

interface BrandState {
  brand: Brand;
  /**
   * False until the Worker's config has landed. Nothing that names or pictures
   * an institute may render before then: the boot screen would otherwise show
   * the default brand's mark for an instant, and on the demo that instant is
   * the institute's logo appearing in front of an audience.
   */
  ready: boolean;
}

const BrandContext = createContext<BrandState>({ brand: resolveBrand(null), ready: false });

/**
 * Which identity the portal is wearing, from the Worker that served it.
 *
 * The brand arrives with the public auth config rather than being built in, so
 * one build serves the institute and the demo and neither can appear as the
 * other. Until the config lands, the institute is assumed: a blank first paint
 * is worse than the right name a moment early, and the institute is the
 * answer that is never wrong to show its own staff.
 */
export function BrandProvider({ children }: { children: ReactNode }) {
  const { config } = useAuth();
  const brand = resolveBrand(config?.brand);

  // The palette is chosen in CSS off this attribute, so every component
  // follows without knowing a brand exists.
  useEffect(() => {
    document.documentElement.dataset.brand = brand.id;
  }, [brand.id]);

  /**
   * The head is static HTML, written before anyone knows which deployment is
   * serving it, so the parts that name or picture the institute are replaced
   * here. Without this the demo's browser tab still says TMI and still shows
   * the institute's mark -- the two places an audience looks first.
   *
   * The demo's icon is a data URI of the same pi mark the sidebar draws, so
   * no second logo file ships.
   */
  useEffect(() => {
    // The platform's short name and full name are the same words; say them once.
    document.title = brand.short === brand.name ? brand.name : `${brand.short} · ${brand.name}`;

    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', `Staff portal for ${brand.name}.`);

    // Each brand paints its own icon. The institute's artwork is a file it
    // owns; every other brand gets the same pi mark the sidebar draws, inline
    // and tinted to its palette's brand-700, so no second logo file ever ships.
    // The head cannot read CSS variables, hence the one hex per brand here.
    const piMark = (tile: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
          `<rect width="48" height="48" rx="13" fill="${tile}"/>` +
          `<g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round">` +
          `<path d="M13 18h22"/><path d="M20 18v14"/>` +
          `<path d="M29 18v10c0 2.6 1.4 4 3.6 4"/></g></svg>`,
      )}`;

    const tile = brand.id === 'platform' ? '#30577D' : '#3a3fb0';
    const icons =
      brand.id === 'institute'
        ? { icon: '/favicon.png', touch: '/logo-mark.png', theme: '#773C7D' }
        : { icon: piMark(tile), touch: piMark(tile), theme: tile };

    document.querySelector('link[rel="icon"]')?.setAttribute('href', icons.icon);
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', icons.touch);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', icons.theme);
  }, [brand]);

  return (
    <BrandContext.Provider value={{ brand, ready: config !== null }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): Brand {
  return useContext(BrandContext).brand;
}

/** Whether the deployment has said which brand it is yet. */
export function useBrandReady(): boolean {
  return useContext(BrandContext).ready;
}

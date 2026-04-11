/** Shared hero page art URLs (StaticHero / CarouselHero image stack + slide overrides). */
export const HERO_IMAGE_DARK_DESKTOP_TABLET = '/images/home/hometophero-desktop-tablet-dark.png'
export const HERO_IMAGE_DARK_MOBILE = '/images/home/hometophero-mobile-dark.png'
export const HERO_IMAGE_LIGHT_DESKTOP_TABLET = '/images/home/hometophero-desktop-tablet-light.png'
export const HERO_IMAGE_LIGHT_MOBILE = '/images/home/hometophero-mobile-light.png'

export const DEFAULT_HERO_STACK_IMAGE_SOURCES = {
  darkDesktopTablet: HERO_IMAGE_DARK_DESKTOP_TABLET,
  darkMobile: HERO_IMAGE_DARK_MOBILE,
  lightDesktopTablet: HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  lightMobile: HERO_IMAGE_LIGHT_MOBILE
} as const

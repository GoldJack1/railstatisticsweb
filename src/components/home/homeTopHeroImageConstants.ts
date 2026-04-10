/** Shared hometophero assets + motion caps (HomeTopHero + HomeHero media). */
export const TOP_HERO_IMAGE_DARK_DESKTOP_TABLET = '/images/home/hometophero-desktop-tablet-dark.png'
export const TOP_HERO_IMAGE_DARK_MOBILE = '/images/home/hometophero-mobile-dark.png'
export const TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET = '/images/home/hometophero-desktop-tablet-light.png'
export const TOP_HERO_IMAGE_LIGHT_MOBILE = '/images/home/hometophero-mobile-light.png'

/** Default slide image sources when using hometophero everywhere (640px breakpoint like TopHero). */
export const DEFAULT_HOMETOPHERO_IMAGE_SOURCES = {
  desktop: TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  tablet: TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  mobile: TOP_HERO_IMAGE_LIGHT_MOBILE
} as const

/** Full light/dark + desktop/mobile URLs for `HomeTopHeroImageStack` / per-slide HomeHero art. */
export const DEFAULT_HERO_STACK_IMAGE_SOURCES = {
  darkDesktopTablet: TOP_HERO_IMAGE_DARK_DESKTOP_TABLET,
  darkMobile: TOP_HERO_IMAGE_DARK_MOBILE,
  lightDesktopTablet: TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  lightMobile: TOP_HERO_IMAGE_LIGHT_MOBILE
} as const

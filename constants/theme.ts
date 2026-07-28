/**
 * Below are the colors that are used in the app.
 */

import { Platform } from 'react-native'
import { Brand, BrandSurfaces } from '@/constants/brand'

export const Colors = {
    light: {
        text: BrandSurfaces.light.text,
        background: BrandSurfaces.light.background,
        surface: BrandSurfaces.light.surface,
        tint: Brand.primary,
        icon: BrandSurfaces.light.textSecondary,
        tabIconDefault: BrandSurfaces.light.textSecondary,
        tabIconSelected: Brand.primary,
        border: BrandSurfaces.light.border,
        primary: Brand.primary,
    },
    dark: {
        text: BrandSurfaces.dark.text,
        background: BrandSurfaces.dark.background,
        surface: BrandSurfaces.dark.surface,
        tint: Brand.primaryMuted,
        icon: BrandSurfaces.dark.textSecondary,
        tabIconDefault: BrandSurfaces.dark.textSecondary,
        tabIconSelected: Brand.primaryMuted,
        border: BrandSurfaces.dark.border,
        primary: Brand.primary,
    },
}

export const Fonts = Platform.select({
    ios: {
        sans: 'system-ui',
        serif: 'ui-serif',
        rounded: 'ui-rounded',
        mono: 'ui-monospace',
    },
    default: {
        sans: 'normal',
        serif: 'serif',
        rounded: 'normal',
        mono: 'monospace',
    },
    web: {
        sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        serif: "Georgia, 'Times New Roman', serif",
        rounded:
            "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
        mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
})

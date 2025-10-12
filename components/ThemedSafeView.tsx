import { useThemeColor } from '@/hooks/use-theme-color'
import {
    SafeAreaView,
    type SafeAreaViewProps,
} from 'react-native-safe-area-context'

export type ThemedSafeViewProps = SafeAreaViewProps & {
    lightColor?: string
    darkColor?: string
}

export function ThemedSafeView({
    style,
    lightColor,
    darkColor,
    edges = ['top', 'bottom'],
    ...otherProps
}: ThemedSafeViewProps) {
    const backgroundColor = useThemeColor(
        { light: lightColor, dark: darkColor },
        'background'
    )

    return (
        <SafeAreaView
            style={[{ backgroundColor }, style]}
            edges={edges}
            {...otherProps}
        />
    )
}

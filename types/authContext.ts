import { User } from './user'

export type AuthContextType = {
    user: User | null
    login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
    logout: () => void
    refreshUser: () => Promise<void>
    /** Odemkne existující session po biometrii (bez hesla). Jen když není „Zůstat přihlášen“. */
    unlockWithBiometric: () => Promise<boolean>
    /** Je biometrie dostupná jako volitelné přihlášení? */
    canUnlockWithBiometric: () => Promise<boolean>
    restoreFromSession: () => Promise<boolean>
    loading: boolean
    sessionLoading: boolean
}

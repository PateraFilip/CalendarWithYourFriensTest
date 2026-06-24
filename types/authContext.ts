import { User } from './user'

export type AuthContextType = {
    user: User | null
    login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
    logout: () => void
    refreshUser: () => Promise<void>
    loading: boolean
    sessionLoading: boolean
}

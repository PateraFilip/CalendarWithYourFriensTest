import { User } from './user'

export type AuthContextType = {
    user: User | null
    login: (username: string, password: string) => Promise<void>
    logout: () => void
    loading: boolean
}

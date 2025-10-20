import { authenticate } from '@/api/login'
import { AuthContextType } from '@/types/authContext'
import { User } from '@/types/user'
import React, { createContext, ReactNode, useState } from 'react'

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(false)

    const login = async (username: string, password: string) => {
        setLoading(true)
        try {
            const loggedInUser = await authenticate(username, password)
            setUser(loggedInUser)
        } finally {
            setLoading(false)
        }
    }

    const logout = () => setUser(null)

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

import { loadStorage, removeStorage, saveStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { AuthContextType } from '@/types/authContext';
import { User } from '@/types/user';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

async function fetchAppUser(authUser: { id: string; email?: string | null }): Promise<User | null> {
    let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

    if (userError || !userData) {
        const { data: userDataByEmail } = await supabase
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .single();
        if (userDataByEmail) userData = userDataByEmail;
    }

    return userData ? (userData as User) : null;
}

async function promptBiometricUnlock(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!compatible || !enrolled) return true; // nelze session, biometrie není

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Odemknout kalendář',
            fallbackLabel: 'Zadej heslo v aplikaci',
            cancelLabel: 'Zrušit',
        });
        return result.success;
    } catch {
        return false;
    }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(false)
    const [sessionLoading, setSessionLoading] = useState(true)

    const applySessionUser = async (authUser: { id: string; email?: string | null }) => {
        const userData = await fetchAppUser(authUser);
        if (userData) {
            setUser(userData);
            await saveStorage('user', JSON.stringify(userData));
            return true;
        }
        setUser(null);
        return false;
    };

    /** Obnovení uživatele z existující Supabase session (po biometrii). */
    const restoreFromSession = async (): Promise<boolean> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return false;
        return applySessionUser(session.user);
    };

    useEffect(() => {
        const loadSession = async () => {
            try {
                await removeStorage('credentials');

                const rememberMeSetting = await loadStorage('rememberMe');
                if (rememberMeSetting === 'false') {
                    await supabase.auth.signOut();
                    await removeStorage('user');
                    setUser(null);
                    setSessionLoading(false);
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const biometricEnabled = await loadStorage('biometricEnabled');
                    if (biometricEnabled === 'true' && Platform.OS !== 'web') {
                        const unlocked = await promptBiometricUnlock();
                        if (!unlocked) {
                            // Session zůstane v úložišti; uživatel může zkusit otisk na login obrazovce
                            setUser(null);
                            setSessionLoading(false);
                            return;
                        }
                    }
                    await applySessionUser(session.user);
                } else {
                    await removeStorage('user');
                    setUser(null);
                }
            } catch (error) {
                console.error('Error loading session:', error);
            } finally {
                setSessionLoading(false);
            }
        };

        loadSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                await applySessionUser(session.user);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                await removeStorage('user');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (username: string, password: string, rememberMe: boolean = false) => {
        setLoading(true)
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: username,
                password,
            });

            if (error) throw error;

            let userData = await fetchAppUser(data.user);

            if (!userData) {
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        username: data.user.email?.split('@')[0] || 'user',
                        email: data.user.email || '',
                        jmeno: '',
                        prijmeni: '',
                        datum_narozeni: null,
                    })
                    .select('*')
                    .single();

                if (insertError || !newUser) {
                    throw new Error(`Nepodařilo se vytvořit uživatelská data: ${insertError?.message}`);
                }
                userData = newUser as User;
            }

            await saveStorage('user', JSON.stringify(userData));
            await saveStorage('lastEmail', username);
            await removeStorage('credentials');
            await saveStorage('rememberMe', rememberMe ? 'true' : 'false');
            // Biometrie odemyká uloženou session (ne heslo)
            await saveStorage('biometricEnabled', rememberMe && Platform.OS !== 'web' ? 'true' : 'false');
            setUser(userData)
        } finally {
            setLoading(false)
        }
    }

    const unlockWithBiometric = async (): Promise<boolean> => {
        const unlocked = await promptBiometricUnlock();
        if (!unlocked) return false;
        return restoreFromSession();
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null)
        await removeStorage('credentials');
        await removeStorage('user');
        // lastEmail a biometricEnabled necháme — usnadní další přihlášení
    }

    const refreshUser = async () => {
        if (!user?.id) return;
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) {
            setUser(data as User);
            await saveStorage('user', JSON.stringify(data));
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                refreshUser,
                unlockWithBiometric,
                restoreFromSession,
                loading,
                sessionLoading,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

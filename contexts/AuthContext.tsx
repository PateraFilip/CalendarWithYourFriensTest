import { loadStorage, removeStorage, saveStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { AuthContextType } from '@/types/authContext';
import { User } from '@/types/user';
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
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

    if (!userError && userData) {
        return {
            ...(userData as User),
            auth_user_id: authUser.id,
        };
    }

    if (authUser.email) {
        const { data: userDataByEmail } = await supabase
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .maybeSingle();
        if (userDataByEmail) {
            // Varování: email match, ale id může ≠ auth.uid() → rozbije RLS
            if (String(userDataByEmail.id) !== String(authUser.id)) {
                console.warn(
                    '[auth] users.id ≠ auth.uid() — oprav profil v DB:',
                    userDataByEmail.id,
                    authUser.id
                );
            }
            return {
                ...(userDataByEmail as User),
                auth_user_id: authUser.id,
            };
        }
    }

    return null;
}

async function promptBiometricUnlock(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
        const LocalAuthentication = await import('expo-local-authentication');
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!compatible || !enrolled) return true;

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

    const restoreFromSession = async (): Promise<boolean> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return false;
        return applySessionUser(session.user);
    };

    useEffect(() => {
        let cancelled = false;

        // Pojistka: nikdy nenech spinner viset donekonečna (typicky deadlock getSession)
        const hangTimeout = setTimeout(() => {
            if (!cancelled) {
                console.warn('[auth] session bootstrap timeout — uvolňuji UI');
                setSessionLoading(false);
            }
        }, 8000);

        const loadSession = async () => {
            try {
                await removeStorage('credentials');

                const rememberMeSetting = await loadStorage('rememberMe');
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) console.error('[auth] getSession:', error.message);

                if (cancelled) return;

                // „Zůstat přihlášen“ → rovnou do appky, bez biometrie
                if (rememberMeSetting === 'true' && session?.user) {
                    await saveStorage('biometricEnabled', 'false');
                    await applySessionUser(session.user);
                    return;
                }

                // Bez remember me: session necháme v úložišti pro volitelné
                // přihlášení biometrií na login obrazovce — do appky ale nevstupuj
                if (!cancelled) {
                    setUser(null);
                    await removeStorage('user');
                }
            } catch (error) {
                console.error('Error loading session:', error);
            } finally {
                if (!cancelled) {
                    clearTimeout(hangTimeout);
                    setSessionLoading(false);
                }
            }
        };

        loadSession();

        // DŮLEŽITÉ: uvnitř onAuthStateChange NIKDY nespouštěj přímo await na supabase
        // (getSession / from) — na webu to deadlockne GoTrue lock a spinner visí.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') return;

            setTimeout(() => {
                if (cancelled) return;
                if (event === 'SIGNED_IN' && session?.user) {
                    applySessionUser(session.user).catch(console.error);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    removeStorage('user').catch(() => {});
                }
            }, 0);
        });

        return () => {
            cancelled = true;
            clearTimeout(hangTimeout);
            subscription.unsubscribe();
        };
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
                userData = {
                    ...(newUser as User),
                    auth_user_id: data.user.id,
                };
            }

            await saveStorage('user', JSON.stringify(userData));
            await saveStorage('lastEmail', username);
            await removeStorage('credentials');
            await saveStorage('rememberMe', rememberMe ? 'true' : 'false');
            // Biometrie = alternativa k heslu, když NENÍ „Zůstat přihlášen“
            await saveStorage(
                'biometricEnabled',
                !rememberMe && Platform.OS !== 'web' ? 'true' : 'false'
            );
            setUser(userData)
            setSessionLoading(false)
        } finally {
            setLoading(false)
        }
    }

    const unlockWithBiometric = async (): Promise<boolean> => {
        const rememberMeSetting = await loadStorage('rememberMe');
        // Biometrie jen když není zapnuté „Zůstat přihlášen“
        if (rememberMeSetting === 'true') return false;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return false;

        const unlocked = await promptBiometricUnlock();
        if (!unlocked) return false;
        return applySessionUser(session.user);
    };

    const canUnlockWithBiometric = async (): Promise<boolean> => {
        if (Platform.OS === 'web') return false;
        const rememberMeSetting = await loadStorage('rememberMe');
        if (rememberMeSetting === 'true') return false;
        const biometricEnabled = await loadStorage('biometricEnabled');
        if (biometricEnabled !== 'true') return false;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return false;
        try {
            const LocalAuthentication = await import('expo-local-authentication');
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            return compatible && enrolled;
        } catch {
            return false;
        }
    };

    const logout = async () => {
        await saveStorage('rememberMe', 'false');
        await saveStorage('biometricEnabled', 'false');
        await supabase.auth.signOut();
        setUser(null)
        await removeStorage('credentials');
        await removeStorage('user');
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
                canUnlockWithBiometric,
                restoreFromSession,
                loading,
                sessionLoading,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

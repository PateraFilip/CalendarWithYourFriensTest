import { loadStorage, saveStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { AuthContextType } from '@/types/authContext';
import { User } from '@/types/user';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(false)
    const [sessionLoading, setSessionLoading] = useState(true)

    // Load saved session on app start
    useEffect(() => {
        const loadSession = async () => {
            try {
                // Check if they wanted to stay logged in
                const rememberMeSetting = await loadStorage('rememberMe');
                if (rememberMeSetting === 'false') {
                    // Sign out explicitly so they are not logged in after restarting
                    await supabase.auth.signOut();
                    await saveStorage('user', '');
                    setUser(null);
                    setSessionLoading(false);
                    return;
                }

                // Try to get current Supabase session
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // Fetch user data from public.users - use id instead of auth_user_id
                    let { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    // If not found by auth_user_id, try by email
                    if (userError || !userData) {
                        const { data: userDataByEmail } = await supabase
                            .from('users')
                            .select('*')
                            .eq('email', session.user.email)
                            .single();

                        if (userDataByEmail) {
                            userData = userDataByEmail;
                        }
                    }

                    if (userData) {
                        setUser(userData as User);
                    }
                } else {
                    // Try to load from storage as fallback
                    const savedUser = await loadStorage('user');
                    if (savedUser) {
                        setUser(JSON.parse(savedUser));

                        // Try auto-login with saved credentials
                        const savedCredentials = await loadStorage('credentials');
                        if (savedCredentials) {
                            const { username, password } = JSON.parse(savedCredentials);
                            await login(username, password, true);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading session:', error);
            } finally {
                setSessionLoading(false);
            }
        };

        loadSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.id);

            if (event === 'SIGNED_IN' && session?.user) {
                console.log('Fetching user data for signed in user');
                // Fetch user data when signed in - use id instead of auth_user_id
                let { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                console.log('User data by id:', { userData, userError });

                if (userError || !userData) {
                    console.log('User not found by auth_user_id, trying email');
                    const { data: userDataByEmail } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', session.user.email)
                        .single();

                    console.log('User data by email:', userDataByEmail);

                    if (userDataByEmail) {
                        userData = userDataByEmail;
                        console.log('Found user by email');
                    }
                }

                if (userData) {
                    console.log('Setting user state:', userData.id);
                    setUser(userData as User);
                } else {
                    console.log('No user data found, setting user to null');
                    setUser(null);
                }
            } else if (event === 'SIGNED_OUT') {
                console.log('User signed out, setting user to null');
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (username: string, password: string, rememberMe: boolean = false) => {
        setLoading(true)
        try {
            // Sign in with Supabase Auth directly
            const { data, error } = await supabase.auth.signInWithPassword({
                email: username,
                password,
            });

            if (error) {
                throw error;
            }

            // Fetch user data from public.users table - try by id first, then by email
            let { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            // If not found by id, try by email
            if (userError || !userData) {
                console.log('User not found by id, trying email lookup');
                const { data: userDataByEmail, error: emailError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', data.user.email)
                    .single();

                console.log('Email lookup result:', { userDataByEmail, emailError });

                if (!emailError && userDataByEmail) {
                    userData = userDataByEmail;
                    console.log('Found user by email');
                }
            }

            // If user still doesn't exist, create them manually
            if (userError || !userData) {
                console.warn('User not found in public.users, creating manually');
                console.log('Attempting to create user with email:', data.user.email);

                // Create user record using Supabase user ID directly
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

                console.log('Insert result:', { newUser, insertError });

                if (insertError || !newUser) {
                    console.error('Failed to create user:', insertError);
                    throw new Error(`Nepodařilo se vytvořit uživatelská data: ${insertError?.message}`);
                }

                userData = newUser;
            }

            const loggedInUser = userData as User;
            await saveStorage('user', JSON.stringify(loggedInUser));
            if (rememberMe) {
                await saveStorage('credentials', JSON.stringify({ username, password }));
                await saveStorage('rememberMe', 'true');
            } else {
                await saveStorage('credentials', '');
                await saveStorage('rememberMe', 'false');
            }
            setUser(loggedInUser)
        } finally {
            setLoading(false)
        }
    }

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null)
        // Clear saved credentials on logout
        await saveStorage('credentials', '');
        await saveStorage('user', '');
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
        <AuthContext.Provider value={{ user, login, logout, refreshUser, loading, sessionLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

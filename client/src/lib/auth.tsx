import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { Me, Role } from './types';

interface AuthState {
    user: Me | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    /** Merge changes to the signed-in user (e.g. a new profile picture) into the session. */
    updateMe: (patch: Partial<Me>) => void;
    is: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<Me | null>(null);
    const [loading, setLoading] = useState(!!getToken());

    useEffect(() => {
        if (!getToken()) return;
        api<Me>('/auth/me')
            .then(setUser)
            .catch(() => setToken(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { token } = await api<{ token: string }>('/auth/login', { body: { email, password } });
        setToken(token);
        setUser(await api<Me>('/auth/me'));
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    const updateMe = useCallback((patch: Partial<Me>) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

    const is = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

    return <AuthContext.Provider value={{ user, loading, login, logout, updateMe, is }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

/** The signed-in user; only call inside the authenticated layout. */
export function useMe() {
    const { user } = useAuth();
    if (!user) throw new Error('Not signed in');
    return user;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {

    // 로그인 확인
    const [isChecking, setIsChecking] = useState(true); // 로그인 여부 확인
    const [isAuthed, setIsAuthed] = useState(false); // 인증된 상태 확인
    const [isCurrentUser, setIsCurrentUser] = useState(null); //현재 로그인한 유저

    // 로그인 상태 복원
    useEffect(() => {
        const token = localStorage.getItem("token");
        const uid = localStorage.getItem("uid");
        if (token && uid) {
            setIsAuthed(true);
            setIsCurrentUser({ uid });
        }
        setIsChecking(false);
    }, []);

    // 토큰 확인
    const signIn = (token, uid) => {
        localStorage.setItem("token", token);
        localStorage.setItem("uid", uid);
        setIsAuthed(true);
        setIsCurrentUser({ uid });
    };

    const signOut = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("uid");
        setIsAuthed(false);
        setIsCurrentUser(null);
    };

    const value = useMemo(() => ({ 
        isChecking, isAuthed, isCurrentUser, signIn, signOut 
    }), [isChecking, isAuthed, isCurrentUser]);
 
    return <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>;
};
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "../styles/login.module.css";

import kakaoLoginImg from "../assets/kakao_login.png";
function Login() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [findModal, setFindModal] = useState(false);

    const navigate = useNavigate();

    const kakaoLogin = async () => {
        window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.REACT_APP_KAKAO_CLIENT_ID}&redirect_uri=${process.env.REACT_APP_KAKAO_REDIRECT_URI}&response_type=code`;
    };

    const kakaoRegister = async () => {
        console.log("[React] 카카오 회원가입 요청 시작");
    
        try {
            // ✅ 1. 카카오 인증을 먼저 진행하여 이메일 가져오기
            window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.REACT_APP_KAKAO_CLIENT_ID}&redirect_uri=${process.env.REACT_APP_KAKAO_REDIRECT_URI}&response_type=code&state=register`;
        } catch (error) {
            console.error("❌ 카카오 로그인 오류:", error);
        }
    };
    // ✅ 카카오 로그인 후 리다이렉트 시 처리
useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get("uid");
    const token = urlParams.get("token");
    const error = urlParams.get("error");
    const email = urlParams.get("email");
    const state = urlParams.get("state"); // 🚨 "register" 값인지 확인

    // ✅ [1] 에러 응답 처리
    if (error) {
        if (error === "already_registered") {
            alert("이미 가입된 계정입니다.");
            navigate("/login");
        } else if (error === "email_not_found") {
            alert("카카오 계정에서 이메일을 가져올 수 없습니다.");
        } else if (error === "user_not_found") {
            alert("회원 정보를 찾을 수 없습니다. 다시 시도해 주세요.");
        }
        return;
    }

    // [2] 회원가입 시도 시 분기 처리
    if (state === "register" && email) {
        axios.post(`${process.env.REACT_APP_BACKEND_URL}/check-email`, { email })
            .then(response => {
                if (response.data.exists) {
                    // alert("이미 가입된 계정입니다.");
                    navigate("/login");
                } else {
                    navigate(`/kakao-register?email=${email}`);
                }
            })
            .catch(error => {
                console.error("❌ 이메일 확인 오류:", error);
                alert("서버 오류가 발생했습니다.");
            });
    }

    // [3] 로그인 성공 처리
    if (token) {
        console.log("✅ 로그인 성공 저장된 정보 1)token:", token,", 2) uid: ", uid);
        localStorage.setItem("token", token);
        // const uid = urlParams.get("uid"); 
        if (uid) {
            localStorage.setItem("uid", uid);
            console.log("✅ uid 저장 완료:", uid);
        } else {
            console.warn("❌❌❌❌❌uid is null❌❌❌❌❌"); 
        }
        navigate("/schedule");
        window.location.reload();
    }
}, [navigate]);

    const normalRegister = async () => {
        window.location.href = `/register`;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post("http://localhost:5001/login", { email, password });

            if (response.data.success) {
                localStorage.setItem("token", response.data.token);  // ✅ 로그인 성공 시 `token` 저장
                
                if (response.data.uid) {
                    localStorage.setItem("uid", response.data.uid);
                }

                navigate("/schedule");  // ✅ 일정 페이지로 이동
                
                window.location.reload();  // ✅ `Navbar` 상태 즉시 반영
            } else {
                setError("아이디 또는 비밀번호를 확인해 주세요.");
            }
        } catch (err) {
            setError("서버 오류가 발생했습니다.");
        }

    };

    const resetPassword = async () => {
        try {
            const response = await axios.post("http://localhost:5001/reset-password", { name, email });

            if (response.data.success) {
                alert("비밀번호 재설정 이메일이 전송되었습니다.");
                setFindModal(false);
            } else {
                setError("일치하는 정보가 없습니다.");
            }
        } catch (err) {
            setError("서버 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.loginWrapper}>
            <div className={styles.loginContainer}>
                <div className={styles.headerWrapper}>
                    <h2 className={styles.loginTitle}>생각한 대로 만들어 보세요.</h2>
                    <h3 className={styles.loginLogo}>plan, nalp.</h3>
                </div>
                <form onSubmit={handleLogin} className={styles.loginForm}>
                    <div className={styles.inputWrapper}>
                    <input 
                        type="text" 
                        placeholder="이메일을 입력하세요" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        autoComplete="email" 
                        className={styles.inputField}
                    />
                    <input 
                        type="password" 
                        placeholder="비밀번호를 입력하세요" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        autoComplete="current-password" 
                        className={styles.inputField}
                    />
                    </div>
                    <div className={styles.buttonWrapper}>
                        <button type="button" onClick={() => setFindModal(true)} className={styles.forgotBtn}>forgot password? </button>
                        <button type="submit" className={styles.loginBtn}>로그인</button>
                        <button type="button" onClick={kakaoLogin} className={styles.kakaoLoginBtn} style={{ backgroundImage: `url(${kakaoLoginImg})` }}></button>
                        <div className={styles.line}></div>
                        <button type="button" onClick={normalRegister} className={styles.registerBtn}>sign in </button>
                        <button type="button" onClick={kakaoRegister} className={styles.kakaoRegisterBtn}>kakao register</button>
                    </div>
                </form>
                {error && <p className={styles.errorMessage}>{error}</p>}
                
                {/* password 찾기 */}
                {findModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} className={styles.inputField} />
                            <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.inputField} />
                            <p>이름과 이메일을 입력하면 비밀번호 재설정 메일을 보내드립니다.</p>
                            <button className={styles.modalButton} onClick={resetPassword}>전송</button>
                            <button className={styles.modalClose} onClick={() => setFindModal(false)}>닫기</button>
                        </div>
                    </div>
                )}
                            
            </div>
        </div>
    );
}

export default Login;
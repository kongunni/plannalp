import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "../styles/kakaoRegister.module.css";

function KakaoRegister() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email");  

    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!email) {
            alert("잘못된 접근입니다.");
            navigate("/");
            return;
        }
    
        // ✅ 기존 회원인지 먼저 확인 후 처리
        const checkExistingUser = async () => {
            try {
                console.log("🔥 이메일 중복 체크:", email);
    
                const emailCheckResponse = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/check-email`, { email });
    
                if (emailCheckResponse.data.exists) {
                    alert("이미 등록된 계정입니다. 로그인 페이지로 이동합니다.");
                    navigate("/login");
                }
            } catch (error) {
                console.error("❌ 이메일 중복 확인 오류:", error);
                alert("서버 오류가 발생했습니다.");
            }
        };
    
        checkExistingUser();
    }, [email, navigate]);

    const handleRegister = async (e) => {
        e.preventDefault();
    
        if (!name.trim()) {
            setError("이름을 입력해주세요.");
            return;
        }
    
        setLoading(true);
    
        try {
            console.log("🔥 회원가입 요청 데이터:", { name, email });
    
            // ✅ 회원가입 요청
            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/kakao-register`, { name, email });
    
            console.log("✅ 회원가입 성공:", response.data);
    
            if (response.data.success) {
                alert("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.");
                navigate("/login");
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            console.error("❌ 회원가입 오류:", err.response?.data || err.message);
    
            if (err.response?.data?.message === "이미 등록된 계정입니다.") {
                alert("이미 등록된 계정입니다. 로그인 페이지로 이동합니다.");
                navigate("/login");
            } else {
                setError(err.response?.data?.message || "서버 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.registerWrapper}>
            <div className={styles.registerContainer}>
                <h2 className={styles.registerTitle}>카카오 간편 회원가입</h2>
                <form onSubmit={handleRegister} className={styles.registerForm}>
                    <input 
                        type="text" 
                        placeholder="이름을 입력하세요" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                        className={styles.inputField} 
                    />
                    <button type="submit" className={styles.registerButton} disabled={loading}>
                        {loading ? "가입 중..." : "가입 완료"}
                    </button>
                </form>
                {error && <p className={styles.errorMessage}>{error}</p>}
            </div>
        </div>
    );
}

export default KakaoRegister;
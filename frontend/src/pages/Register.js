import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "../styles/register.module.css";

// ✅ 이름 검증 함수 (한글만, 2~6자)
const isValidName = (name) => /^[가-힣]{2,6}$/.test(name);

// ✅ 비밀번호 검증 함수 (최소 6자 이상, 숫자/영어/특수문자 `! @ _ - . =` 만 가능)
const isValidPassword = (password) => /^[A-Za-z\d!@_\-.=]{6,}$/.test(password);

// ✅ 비밀번호 일치 여부 확인
const isPasswordMatch = (password, confirmPassword) => password === confirmPassword;

// ✅ 이메일 형식이 완전한지 확인하는 함수 (`.com`, `.co.kr` 등 끝까지 입력했는지 체크)
const isFullyValidEmail = (email) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|co\.kr|kr)$/.test(email);

const Register = () => {
    const [uname, setUname] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    // ✅ 유효성 검사 메시지 상태 관리
    const [nameMessage, setNameMessage] = useState("⚠️ 한글 2~6자로 입력하세요.");
    const [emailMessage, setEmailMessage] = useState("⚠️ 유효한 이메일을 입력하세요.");
    const [passwordMessage, setPasswordMessage] = useState("⚠️ 숫자, 영문, 특수문자(!@_- .=) 포함 6자 이상");
    const [confirmPasswordMessage, setConfirmPasswordMessage] = useState("");

    const [error, setError] = useState("");
    const navigate = useNavigate();

    // ✅ 이메일 중복 확인 함수
    const checkEmailDuplicate = async (emailInput) => {
        if (!isFullyValidEmail(emailInput)) {
            setEmailMessage("⚠️ 유효한 이메일을 입력하세요.");
            return;
        }
        try {
            const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/check-email`, { email: emailInput });

            if (response.data.exists) {
                setEmailMessage("❌ 이미 사용 중인 이메일입니다.");
            } else {
                setEmailMessage("✅ 사용 가능한 이메일입니다.");
            }
        } catch (err) {
            console.error("❌ 이메일 중복 확인 오류:", err);
            setEmailMessage("서버 오류 발생");
        }
    };

    // ✅ 이메일 입력값이 변경될 때 즉시 유효성 검사 실행
    const handleEmailChange = (e) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        
        if (isFullyValidEmail(newEmail)) {
            checkEmailDuplicate(newEmail);
        } else {
            setEmailMessage("⚠️ 유효한 이메일을 입력하세요.");
        }
    };

    // ✅ 이름 입력값 변경 감지 (실시간 유효성 검사)
    const handleNameChange = (e) => {
        const newName = e.target.value;
        setUname(newName);

        if (/\s/.test(newName)) {
            setNameMessage("❌ 공백을 포함할 수 없습니다.");
        } else if (!isValidName(newName)) {  // ✅ 함수 활용
            setNameMessage("❌ 한글 2~6자로 입력하세요.");
        } else {
            setNameMessage("✅ 사용 가능한 이름입니다.");
        }
    };


    // ✅ 비밀번호 입력값 변경 감지 (실시간 유효성 검사)
    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);

        if (!isValidPassword(newPassword)) {
            setPasswordMessage("❌ 최소 6자 이상, 숫자/영문/특수문자(!@_- .=) 포함");
        } else {
            setPasswordMessage("✅ 사용 가능한 비밀번호입니다.");
        }

        // 비밀번호 확인 필드도 즉시 체크
        setConfirmPasswordMessage(isPasswordMatch(newPassword, confirmPassword) ? "✅ 비밀번호가 일치합니다." : "❌ 비밀번호가 일치하지 않습니다.");
    };

    // ✅ 비밀번호 확인 입력값 변경 감지 (실시간 유효성 검사)
    const handleConfirmPasswordChange = (e) => {
        const newConfirmPassword = e.target.value;
        setConfirmPassword(newConfirmPassword);

        setConfirmPasswordMessage(isPasswordMatch(password, newConfirmPassword) ? "✅ 비밀번호가 일치합니다." : "❌ 비밀번호가 일치하지 않습니다.");
    };

    // ✅ 회원가입 요청 함수
    const handleRegister = async (e) => {
        e.preventDefault();

        if (nameMessage.includes("❌") || emailMessage.includes("❌") || passwordMessage.includes("❌") || confirmPasswordMessage.includes("❌")) {
            setError("⚠️ 입력을 확인해 주세요. ");
            return;
        }

        try {
            const response = await axios.post("http://localhost:5001/register", { uname, email, password });
            if (response.data.success) {
                alert("회원가입이 완료되었습니다. 로그인해주세요.");
                navigate("/login"); // 로그인 페이지로 이동
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || "서버 오류가 발생했습니다.");
        }
    };

    return (
        <div className={styles.registerWrapper}>
            <div className={styles.registerContainer}>
                <h2 className={styles.registerTitle}>회원가입</h2>
                <form onSubmit={handleRegister} className={styles.registerForm}>
                    <input 
                        type="text" 
                        placeholder="이름 (한글 2~6자)" 
                        value={uname} 
                        onChange={handleNameChange} 
                        required 
                        className={styles.inputField}
                    />
                    <p className={styles.validationMessage}>{nameMessage}</p>

                    <input 
                        type="email" 
                        placeholder="이메일" 
                        value={email} 
                        onChange={handleEmailChange} 
                        required 
                        className={styles.inputField}
                    />
                    <p className={styles.validationMessage}>{emailMessage}</p>

                    <input 
                        type="password" 
                        placeholder="비밀번호 (최소 6자, !@_- .= 허용)" 
                        value={password} 
                        onChange={handlePasswordChange} 
                        required 
                        className={styles.inputField}
                    />
                    <p className={styles.validationMessage}>{passwordMessage}</p>

                    <input 
                        type="password" 
                        placeholder="비밀번호 확인" 
                        value={confirmPassword} 
                        onChange={handleConfirmPasswordChange} 
                        required 
                        className={styles.inputField}
                    />
                    <p className={styles.validationMessage}>{confirmPasswordMessage}</p>

                    <button type="submit" className={styles.registerButton}>회원가입</button>
                </form>
                {error && <p className={styles.errorMessage}>{error}</p>}
            </div>
        </div>
    );
};

export default Register;

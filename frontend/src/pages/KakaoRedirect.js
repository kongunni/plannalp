// export default KakaoRedirect;
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

function KakaoRedirect() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = searchParams.get("token");
    const uid = searchParams.get("uid");

    useEffect(() => {
        if (token) {
            console.log("🔑 저장된 카카오 로그인 토큰:", token);
            localStorage.setItem("token", token); 

            if (uid) {
                localStorage.setItem("uid", uid);
                console.log("✅ uid 저장됨:", uid);
            } else {
                console.warn("❌ uid 없음 — 페이지 추가 등 일부 기능 제한될 수 있음");
            }

            navigate("/schedule"); 
            window.location.reload();
        } else {
            alert("카카오 로그인 실패");
            navigate("/login");
        }
    }, [token, uid, navigate]);

    return <p>카카오 로그인 처리 중...</p>;
}

export default KakaoRedirect;

import "./styles/global.css";
import React, { useState, useEffect } from "react";
// import { useAuth } from "./components/AuthContext";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import reportWebVitals from "./reportWebVitals";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import MainContents from "./pages/MainContents";
import Login from "./pages/Login";
import KakaoRedirect from "./pages/KakaoRedirect";
import Register from "./pages/Register";
import KakaoRegister from "./pages/KakaoRegister";
import Schedule from "./pages/Schedule";
import ScheduleDetail from "./pages/ScheduleDetail";
import CalendarView from "./components/CalendarView";
import Sidebar from "./components/Sidebar";
import { PageProvider, usePageContext } from "./components/PageContext";
import { AuthProvider } from "./components/AuthContext";

const RootComponent = () => {
    const { isModalOpen } = usePageContext();

    const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
    const [fontStyle, setFontStyle] = useState(localStorage.getItem("fontStyle") || "default");
    const [smallText, setSmallText] = useState(localStorage.getItem("smallText") === "true");
    const [pageLocked, setPageLocked] = useState(localStorage.getItem("pageLocked") === "true");
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // 🔥 사이드바 상태
    const [selectedPid, setSelectedPid] = useState(localStorage.getItem("selectedPid") || "1"); // 선택된 페이지 ID

    // const { isModalOpen, setIsModalOpen } = usePageContext();

    useEffect(() => {
        console.log("🔥 darkMode 상태:", darkMode);
         // 🔥 다크 모드 적용 로직 (기본값은 꺼져 있어야 함)
         if (darkMode) {
            document.body.classList.add("dark-mode");
            console.log("✅ dark-mode 클래스 추가됨");
        } else {
            document.body.classList.remove("dark-mode");
            console.log(" dark-mode 클래스 추가안됨");
        }

        // 🔥 작은 텍스트 적용
        if (smallText) {
            document.body.classList.add("small-text");
        } else {
            document.body.classList.remove("small-text");
        }

        // 🔥 페이지 잠금 적용
        const container = document.querySelector(".main-container");
        if (container) {
            if (pageLocked) {
                container.classList.add("page-locked");
            } else {
                container.classList.remove("page-locked");
            }
        }

        // 🔥 폰트 스타일 적용
        document.body.style.fontFamily =
            fontStyle === "serif" ? "'Noto Serif KR', serif"
            : fontStyle === "mono" ? "Courier New, monospace"
            : "Arial, sans-serif";

        // 🔥 로컬 스토리지에 값 저장
        localStorage.setItem("darkMode", darkMode);
        localStorage.setItem("fontStyle", fontStyle);
        localStorage.setItem("smallText", smallText);
        localStorage.setItem("pageLocked", pageLocked);
    }, [darkMode, fontStyle, smallText, pageLocked]);

    useEffect(() => {
        if (isSidebarExpanded) {
            document.body.classList.add("expanded");
            document.body.classList.remove("collapsed");
            console.log("📂 Sidebar Expanded");
        } else {
            document.body.classList.add("collapsed");
            document.body.classList.remove("expanded");
            console.log("📂 Sidebar Collpased");
        }
    }, [isSidebarExpanded]);

    console.log("isSidebar: ", isSidebarExpanded);
    
    return (
        <div id="page-wrapper" className={`page-wrapper ${isModalOpen ? "modal-open" : ""}`}>
        <Navbar
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((prev) => !prev)}
            onFontChange={setFontStyle}
            onToggleSmallText={() => setSmallText((prev) => !prev)}
            onTogglePageLock={() => setPageLocked((prev) => !prev)}
        />

        <div className="content-wrapper">
            <Sidebar 
                selectedPid={selectedPid} 
                setSelectedPid={setSelectedPid} 
                isExpanded={isSidebarExpanded} 
                setIsExpanded={setIsSidebarExpanded}
            />

            <div id="main-container" className={`main-container ${pageLocked ? "page-locked" : ""}`}>
                <Routes>
                    <Route path="/" element={<MainContents darkMode={darkMode}/>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/kakao-redirect" element={<KakaoRedirect />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/kakao-register" element={<KakaoRegister />} />
                    <Route path="/schedule" element={<Schedule darkMode={darkMode} pageLocked={pageLocked} smallText={smallText} />} />
                    <Route path="/pages/:pid" element={<ScheduleDetail darkMode={darkMode} pageLocked={pageLocked} smallText={smallText} />} />
                    <Route path="/calendar" element={<CalendarView darkMode={darkMode} pageLocked={pageLocked} smallText={smallText} />} />
                </Routes>
            </div>
        </div>
            
        <Footer />
    </div>    
    );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <AuthProvider>
        <PageProvider>
            <Router>
                <RootComponent />
            </Router>
        </PageProvider>
    </AuthProvider>
);


reportWebVitals();

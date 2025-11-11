import React, { useCallback, useEffect, useRef, useState } from "react";
// import { BsLock, BsLink45Deg } from "react-icons/bs"; // 🔗 아이콘 추가
import { FiType } from "react-icons/fi";
import { IoSearchOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import styles from "../styles/navbar.module.css";

const Navbar = ({ darkMode, onToggleDarkMode, onFontChange, onToggleSmallText, onTogglePageLock }) => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    const [smallText, setSmallText] = useState(localStorage.getItem("smallText") === "true");
    const [pageLocked, setPageLocked] = useState(localStorage.getItem("pageLocked") === "true");
    const [fontStyle, setFontStyle] = useState(localStorage.getItem("fontStyle") || "default");

    // 📌 `⋯` 메뉴 위치 자동 조정
    const updateMenuPosition = useCallback(() => {
      if (menuOpen && buttonRef.current && menuRef.current) {
          const buttonRect = buttonRef.current.getBoundingClientRect();
          menuRef.current.style.top = `${buttonRect.bottom + 15}px`; // `⋯` 아래 5px
          menuRef.current.style.left = `${buttonRect.left - 200}px`; // 버튼과 같은 X축 정렬
      }
    }, [menuOpen]);
  

  // 📌 메뉴 위치 업데이트 (창 크기 변경 시)
  useEffect(() => {
    window.addEventListener("resize", updateMenuPosition);
    return () => {
        window.removeEventListener("resize", updateMenuPosition);
    };
  }, [updateMenuPosition]);

 // 📌 메뉴 토글 시 위치 업데이트
  useEffect(() => {
    updateMenuPosition();
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
        const checkLoginStatus = () => {
            setIsLoggedIn(!!localStorage.getItem("token"));
            console.log("📌 현재 저장된 토큰:", localStorage.getItem("token"));
        };
        window.addEventListener("storage", checkLoginStatus);
        return () => {
            window.removeEventListener("storage", checkLoginStatus);
        };
  }, []);

  const handleLogout = () => {
      alert("Logout success!");
      localStorage.removeItem("token");
      setIsLoggedIn(false);
      navigate("/");
  };

  const handleStart = () => {
    if (isLoggedIn) {
        navigate("/schedule");
    } else {
        navigate("/login");
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);


  // 📌 글꼴 변경
  const handleFontChange = (newFont) => {
      setFontStyle(newFont);
      localStorage.setItem("fontStyle", newFont);
      document.body.style.fontFamily =
          newFont === "serif" ? "Georgia, serif"
          : newFont === "mono" ? "Courier New, monospace"
          : "Arial, sans-serif";

      if (onFontChange) {
          onFontChange(newFont);
      }
  };

  // 📌 작은 텍스트 토글
  const handleSmallTextToggle = () => {
      const newSize = !smallText;
      setSmallText(newSize);
      localStorage.setItem("smallText", newSize);
      onToggleSmallText(newSize);
  };

  // 📌 페이지 잠금 토글
  const handlePageLockToggle = () => {
      const newLock = !pageLocked;
      setPageLocked(newLock);
      localStorage.setItem("pageLocked", newLock);
      onTogglePageLock(newLock);
  };

  // 📌 현재 URL 복사
  const handleCopyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      alert("🔗 링크가 복사되었습니다!");
  };


  return (
    <div className={styles.navContainer}>
      <nav className={styles.navbar}>
        <div className={styles.navSection}>
          <a className={styles.navLogo} href="/">plan, nalp.</a>
        </div>
        <div className={styles.navItem}>
          <ul className={styles.navItemSection}>
            {isLoggedIn && (
              <li className={styles.navLink}>
              <button className={`${styles.navButton} ${styles.logoutButton}`} onClick={handleLogout}>Logout</button>
          </li>
            )}
            <li className={styles.navLink}>
              <button ref={buttonRef} className={styles.navButton} onClick={handleStart}>start</button>
            </li>
          </ul>

          <button ref={buttonRef} className={styles.menuButton} onClick={toggleMenu}>⋯</button>

        </div>

          <div className={styles.navBar}>
            {menuOpen && (
              <div ref={menuRef} className={styles.menu}>
                
                {/* 🔍 검색창 */}
                <div className={styles.searchBox}>
                  <IoSearchOutline className={styles.searchIcon} />
                  <input type="text" placeholder="작업 검색..." />
                </div>

                {/* 다크모드 */}
                <div className={`${styles.toggleSwitch} ${darkMode ? styles.active : ""}`} onClick={onToggleDarkMode}>
                  <span>{darkMode ? "☀️ 라이트 모드" : "🌙 다크 모드"}</span>
                  <div className={styles.toggleSlider}></div>
                </div>
                
                  {/* 📝 폰트 선택 */}
                <div className={styles.fontSelector}>
                  <div className={`${styles.fontOption} ${fontStyle === "default" ? styles.active : ""}`} onClick={() => handleFontChange("default")}>
                    <FiType className={styles.fontIcon} />
                    <span>기본</span>
                  </div>
                  <div className={`${styles.fontOption} ${fontStyle === "serif" ? styles.active : ""}`} onClick={() => handleFontChange("serif")}>
                      <FiType className={styles.fontIcon} />
                      <span>세리프</span>
                  </div>
                  <div className={`${styles.fontOption} ${fontStyle === "mono" ? styles.active : ""}`} onClick={() => handleFontChange("mono")}>
                    <FiType className={styles.fontIcon} />
                    <span>모노</span>
                  </div>
                </div>


              {/* 텍스트 크기 설정 */}
              <div className={`${styles.toggleSwitch} ${smallText ? styles.active : ""}`} onClick={handleSmallTextToggle}>
                <span>🔡 작은 텍스트</span>
                <div className={styles.toggleSlider}></div>
              </div>

              {/* 페이지 잠금 설정 */}
              <div className={`${styles.toggleSwitch} ${pageLocked ? styles.active : ""}`} onClick={handlePageLockToggle}>
                <span>🔒 페이지 잠금</span>
                <div className={styles.toggleSlider}></div>
              </div>

              {/* 📎 링크 복사 */}
              <div className={styles.menuItem} onClick={handleCopyLink}>
                <div className={styles.icon} />
                  <span>🔗 링크 복사</span>
                </div>
              </div>
            )}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;

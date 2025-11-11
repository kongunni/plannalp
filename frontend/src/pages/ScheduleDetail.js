import React, { useEffect, useState } from "react";
import { usePageContext } from "../components/PageContext";
import { renamePage, fetchCallout, saveCallout  } from "../services/PageService";
import ScheduleList from "../components/ScheduleList.js";
import Modal from "../components/Modal";
import CalendarView from "../components/CalendarView.js"; 
import styles from "../styles/schedule.module.css";
import { useParams } from "react-router-dom";

function ScheduleDetail({ darkMode, pageLocked, smallText }) {
    const uid = localStorage.getItem("uid");
    const { pid} = useParams();
    const numericPid = pid ? Number(pid) : null;
    
    const { loadSchedules } = usePageContext();


    // 모달 활성화 감지 
    const { isModalOpen, setIsModalOpen } = usePageContext();

    // 공통함수
    const { pages, loadPages } = usePageContext();
    const [viewMode, setViewMode] = useState("list"); 
    const [isSidebarExpanded] = useState(true);
    // console.log("🛠️ usePageContext() 반환 값:", { pages, loadPages });  
    
    // 제목 상태
    const [pageTitle, setPageTitle] = useState(""); // 현재 제목
    const [isEditing, setIsEditing] = useState(false); //제목 수정 
    const [newTitle, setNewTitle] = useState(""); // 수정할 제목

    // 콜아웃
    const [callout, setCallout] = useState("");
    const [typingTimeout, setTypingTimeout] = useState(null);

    // ✅ 페이지 목록이 변경되거나 `pid`가 바뀔 때 제목 업데이트
    useEffect(() => {
        const currentPage = pages.find((p) => p.pid === numericPid);
        if (currentPage) {
            console.log("✅ 찾은 페이지 제목:", currentPage.title); 
            setPageTitle(currentPage.title);
        } else {
            console.log("⚠️ 페이지를 찾을 수 없음!"); 
            setPageTitle("제목없음");
        }
    }, [pages, numericPid, pid]); 

    // ✅ 페이지 제목이 변경되었을 때 목록 다시 불러오기
    useEffect(() => {
        const handlePageTitleUpdated = () => {
            console.log("📢 페이지 제목 변경 감지됨! 목록 갱신");
            loadPages();
        };

        window.addEventListener("pageTitleUpdated", handlePageTitleUpdated);

        return () => {
            window.removeEventListener("pageTitleUpdated", handlePageTitleUpdated);
        };
    }, [loadPages]);

    // ✅ 페이지 로드시 콜아웃 불러오기 
    useEffect(() => {
        
        const loadCallout = async () => {
            const fetchedCallout = await fetchCallout(uid, pid);
            console.log("📢 불러온 콜아웃 데이터:", fetchedCallout);

            // ✅ 콜아웃 데이터가 객체일 경우 대비
            const calloutText = typeof fetchedCallout === "object" ? fetchedCallout.callout : fetchedCallout;
            setCallout(calloutText || "");
            // setCallout(fetchedCallout?.callout || "");
        };

        loadCallout();

        const handleCalloutUpdated = () => {
            console.log("📢 콜아웃 변경 감지됨! 다시 불러옴");
            loadCallout();
        };

        window.addEventListener("calloutUpdated", handleCalloutUpdated);

        return () => {
            window.removeEventListener("calloutUpdated", handleCalloutUpdated);
        };
    }, [uid, pid]);

    useEffect(() => {
        const handleScheduleUpdated = () => {
            console.log("📢 일정 변경 감지됨! 목록 다시 불러옴");
            loadSchedules(numericPid);
        };

        window.addEventListener("scheduleAdded", handleScheduleUpdated);
        window.addEventListener("scheduleUpdated", handleScheduleUpdated);
        window.addEventListener("scheduleDeleted", handleScheduleUpdated);

        return () => {
            window.removeEventListener("scheduleAdded", handleScheduleUpdated);
            window.removeEventListener("scheduleUpdated", handleScheduleUpdated);
            window.removeEventListener("scheduleDeleted", handleScheduleUpdated);
        };
    }, [numericPid, loadSchedules]);


     // ✅ 콜아웃 자동 저장 (2초 뒤)
    const handleCalloutChange = (e) => {
        const newText = e.target.value;
        setCallout(newText);

        if (typingTimeout) clearTimeout(typingTimeout);

        const newTimeout = setTimeout(async () => {
            if (newText.trim() !== "") {
                await saveCallout(uid, numericPid, newText.trim());
            }
        }, 2000);

        setTypingTimeout(newTimeout);
    };

    // ✅ 엔터키 입력 시 즉시 저장
    const handleCalloutKeyDown = async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (callout.trim() !== "") {
                await saveCallout(uid, numericPid, callout.trim());
            }
        }
    };



    // ✅ 제목 수정 모드 활성화 
    const handleTitleClick = () => {
        setIsEditing(true);
        setNewTitle(pageTitle);
    };

    // ✅ 제목 변경
    const handleTitleChange = (e) => {
        setNewTitle(e.target.value);
    };

    // ✅ 엔터키로 제목 저장
    const handleTitleSubmit = async (e) => {
        if (e.key === "Enter" && newTitle.trim()) {
            e.preventDefault();
            try {
                await renamePage(pid, newTitle.trim(), true);
                window.dispatchEvent(new Event("pageTitleUpdated"));
                setIsEditing(false);
            } catch (error) {
                console.error("❌ 페이지 제목 변경 실패:", error);
            }
        }
    };

    // ✅ 포커스 벗어나면 수정 취소 
    const handleTitleBlur = () => {
        setIsEditing(false);
    };

    useEffect(() => {
        if (isModalOpen) {
            document.getElementById("page-wrapper").classList.add("modal-open");
        } else {
            document.getElementById("page-wrapper").classList.remove("modal-open");
        }
    }, [isModalOpen]);
    

    return (
        <div className={`${styles.appContainer} ${isSidebarExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.scheduleTitleContainer}>
                <div className={styles.scheduleTitleWrapper}>
                    <div className={styles.titleSection}>
                    {isEditing ? (
                        <input
                            type="text"
                            className={styles.scheduleTitleInput}
                            value={newTitle}
                            onChange={handleTitleChange}
                            onKeyDown={handleTitleSubmit}
                            onBlur={handleTitleBlur}
                            placeholder="페이지명을 입력한 후 Enter키를 누르세요."
                            autoFocus
                        />
                    ) : (
                        <h1 className={styles.scheduleTitle} onClick={handleTitleClick}>
                            {pageTitle}
                        </h1>
                    )}
                    </div>
                </div>

                <div className={styles.guideContainer}>
                    <h5> ⓘ 제목을 클릭하면 수정 모드가 활성화됩니다 </h5>
                </div>
            </div>

            {/* 콘텐츠 영역 */}
            <div className={`${styles.mainContainer} ${darkMode ? styles.darkMode : ""}`}>
                <div className={styles.calloutContainer}>
                    <textarea
                        className={styles.calloutInput}
                        value={callout || ""}
                        onChange={handleCalloutChange}
                        onKeyDown={handleCalloutKeyDown}
                    />
                    <div className={styles.guideContainer}>
                        <h5> ⓘ 페이지 소개를 입력하세요. Enter키를 누르면 즉시 저장되며, 2초 후 자동 저장됩니다 </h5>
                    </div>
                </div>

                <div className={styles.toolbarContainer}>
                    <div className={styles.buttonContainer}>
                        <button className={styles.addButton} onClick={() => setIsModalOpen(true)} disabled={pageLocked}
                            >+ 일정 추가
                        </button>
                    </div>

                    <div className={styles.viewFilter}>
                        <label htmlFor="viewMode">레이아웃:</label>
                        <select 
                            id="viewMode" 
                            value={viewMode} 
                            onChange={(e) => setViewMode(e.target.value)}>
                            <option value="list">≡ 리스트</option>
                            <option value="calendar">≔ 캘린더</option>
                        </select>
                    </div>
                </div>

                {isModalOpen && <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} pageLocked={pageLocked} />}

                {viewMode === "list" ? (
                    <ScheduleList uid= {uid} pid={pid} />
                ) : (
                    <CalendarView uid={uid} pid={pid} />
                )}
            </div>
        </div>
    );
}

export default ScheduleDetail;


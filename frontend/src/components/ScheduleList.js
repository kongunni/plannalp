import React, { useState, useEffect } from "react";
import { usePageContext } from "../components/PageContext";
import { useParams } from "react-router-dom";
import { deleteSchedule, updateSchedule } from "../services/PageService";
import styles from "../styles/schedule.module.css";
import Modal from "./Modal";
import { getTagColor, getTextColor } from "../utils/colorStorage";

const ScheduleList = ({ darkMode, smallText, pageLocked, isSidebarExpanded }) => {
    const { schedulesList = [], loadSchedules } = usePageContext(); 
    const { pid } = useParams();
    
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [selectedTag, setSelectedTag] = useState("all");
    const [sortType, setSortType] = useState("등록순");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const pagesPerGroup = 10;

    useEffect(() => {
        if (pid) {
            loadSchedules(pid); // ✅ 컴포넌트 마운트 시 일정 목록 불러오기
        }
    }, [pid, loadSchedules]);
    
    // ✅ 날짜 변환 (YYYY.MM.DD)
    const formatDateTime = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        return `${year}-${month}-${day} ${ampm} ${String(hours).padStart(2, "0")}:${minutes}`;
    };

    // ✅ 일정 삭제
    const handleDelete = async (sid) => {
        if (window.confirm("삭제하시겠습니까?")) {
            await deleteSchedule(sid);
            window.dispatchEvent(new Event("scheduleDeleted"));
            loadSchedules(pid); // 🔥 **************** 수정 **************** //
            setSelectedSchedule(null);
        }
    };

    // ✅ 일정 수정
    const handleUpdate = async (updatedSchedule) => {
        await updateSchedule(updatedSchedule);
        window.dispatchEvent(new Event("scheduleUpdated"));
        loadSchedules(pid); // 🔥 **************** 수정 **************** //
        setSelectedSchedule(null);
    };

    // ✅ 태그 필터 적용
    const filteredSchedules = selectedTag === "all" 
        ? schedulesList 
        : schedulesList.filter((schedule) => schedule.tag === selectedTag);

    //  ✅ 정렬 적용
    const sortedSchedules = [...(filteredSchedules || [])].sort((a, b) => {
        if (sortType === "등록순") return b.sid - a.sid;
        if (sortType === "가까운 일정순") return new Date(a.start_date) - new Date(b.start_date);
        if (sortType === "오래된 일정순") return new Date(b.start_date) - new Date(a.start_date);
        return 0;
    });

    // ✅ 페이징 처리
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSchedules = sortedSchedules.slice(indexOfFirstItem, indexOfLastItem);

    const totalPages = Math.ceil(sortedSchedules.length / itemsPerPage);
    const currentGroup = Math.ceil(currentPage / pagesPerGroup);
    const startPage = (currentGroup - 1) * pagesPerGroup + 1;
    const endPage = Math.min(startPage + pagesPerGroup - 1, totalPages);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const goToPreviousGroup = () => {
        if (startPage > 1) setCurrentPage(startPage - 1);
    };
    const goToNextGroup = () => {
        if (endPage < totalPages) setCurrentPage(endPage + 1);
    };

    // ✅ 모달 열기
    const handleScheduleClick = (schedule) => {
        if (!schedule) {
            console.error("❌ 클릭한 일정이 없습니다!");
            return;
        }
        setSelectedSchedule(schedule);
    };

    // ✅ 모달 닫기
    const closeModal = () => {
        setSelectedSchedule(null);
    };

    return (
        <div className={`${styles.scheduleList} ${isSidebarExpanded ? styles.expanded : ""} ${darkMode ? styles.darkMode : ""}`}>
            {/* 🔥 태그 필터 */}
            <div className={styles.filterContainer}>
                <label>태그: </label>
                <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                    <option value="all">전 체</option>
                    {[...new Set(schedulesList.map((s) => s.tag).filter(Boolean))].map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
            </div>

            {/* 🔥 정렬 필터 */}
            <div className={styles.filterContainer}>
                <label>정렬:</label>
                <select value={sortType} onChange={(e) => setSortType(e.target.value)}>
                    <option value="등록순">등록순</option>
                    <option value="가까운 일정순">가까운 일정순</option>
                    <option value="오래된 일정순">오래된 일정순</option>
                </select>
            </div>

            {/* 🔥 일정 목록 */}
            <div className={styles.scheduleListContainer}>
                {currentSchedules.length === 0 ? (
                    <div className={styles.scheduleListWrapper}>
                        <p className={styles.emptyMessage}>📌 등록된 일정이 없습니다.</p>
                    </div>
                ) : (
                    <div className={styles.scheduleListWrapper}>
                        <ul>
                            {currentSchedules.map((schedule) => (
                                <li 
                                    key={schedule.sid} 
                                    onClick={() => handleScheduleClick(schedule)}
                                    className={styles.scheduleItem}
                                >    
                                    <div className={styles.scheduleTitle}>
                                        <strong>{schedule.title}</strong>
                                    </div>
                                    <div className={styles.scheduleDate}>
                                        {schedule.end_date ? (
                                            <>
                                                {formatDateTime(schedule.start_date)} <br />
                                                {formatDateTime(schedule.end_date)}
                                            </>
                                        ) : (
                                            formatDateTime(schedule.start_date)
                                        )}
                                    </div>
                                    <div className={styles.scheduleTag}>
                                        <span className={styles.tagBadge} style={{ backgroundColor: schedule.tagColor || getTagColor(schedule.tag) || "#ccc", color: getTextColor(schedule.tagColor || getTagColor(schedule.tag)) }}>
                                            {schedule.tag || ""}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* 🔥 일정 상세 모달 */}
            {selectedSchedule && (
                <Modal
                    isOpen={Boolean(selectedSchedule)}
                    schedule={selectedSchedule}
                    onClose={closeModal}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    pageLocked={pageLocked}
                />
            )}

            {/* 🔥 페이지네이션 */}
            <div className={styles.pagination}>
                <button onClick={goToPreviousGroup} disabled={startPage === 1}>{"<"}</button>
                {Array.from({ length: endPage - startPage + 1 }, (_, i) => (
                    <button 
                        key={startPage + i} 
                        onClick={() => paginate(startPage + i)}
                        className={currentPage === startPage + i ? styles.activePage : ""}
                    >
                        {startPage + i}
                    </button>
                ))}
                <button onClick={goToNextGroup} disabled={endPage === totalPages}>{">"}</button>
            </div>
        </div>
    );
};

export default ScheduleList;


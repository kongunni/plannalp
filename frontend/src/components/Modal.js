import React, { useState, useEffect } from "react";
import { apiRequest , fetchSchedulesByPage } from "../services/PageService"; 
import ReactDOM from "react-dom";
import { useParams } from "react-router-dom";
import styles from "../styles/modal.module.css";
import { setTagColor, getTagColor } from "../utils/colorStorage";

const Modal = ({  isOpen, onClose, schedule, onDelete, onUpdate, pageLocked }) => {
    const uid = localStorage.getItem("uid");
    const { pid} = useParams();
    const numericPid = pid ? Number(pid) : null;
    // console.log("✅ 모달이 받는 schedule 데이터:", schedule);

    const [isEditing, setIsEditing] = useState(false);
    const [isAddingSchedule, setIsAddingSchedule] = useState(!schedule);
    const [noEndDate, setNoEndDate] = useState(!schedule?.end_date);

    const [newSchedule, setNewSchedule] = useState({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        tag: "",
        tagColor: "#ff0000",
    });

    // ✅ 날짜 변환 함수
    // ✅ "YYYY-MM-DDTHH:MM" 형식 반환 (datetime-local 입력 필드용)
    const formatDateForInput = (isoString) => {
        if (!isoString) return "";

        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0"); // 24시간제
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // ✅ "YYYY-MM-DD AM/PM HH:MM" 형
    const formatDateForDisplay = (isoString) => {
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

 
    const [editedSchedule, setEditedSchedule] = useState({
        sid: schedule?.sid || "",
        title: schedule?.title || "",
        start_date: schedule?.start_date ? formatDateForInput(schedule.start_date) : "",
        end_date: schedule?.end_date ? formatDateForInput(schedule.end_date) : "",
        tag: schedule?.tag || "",
        description: schedule?.description || "",
        tagColor: schedule?.tagColor || getTagColor(schedule?.tag),
    });

    // ✅ ESC 키 누르면 모달 닫기
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // ✅ 모달이 닫혀있으면 렌더링하지 않음
    if (!isOpen) return null;

    // ✅ 일정 추가 핸들러
    const handleAddSchedule = async () => {
        if (!uid || !numericPid|| !newSchedule.title || !newSchedule.start_date) { 
            alert("📌 필수 입력값을 모두 입력해주세요.");
            return;
        }
        const requestData = {
            uid,
            pid: numericPid,  
            title: newSchedule.title,
            description: newSchedule.description || null,
            start_date: newSchedule.start_date,
            end_date: noEndDate ? null : newSchedule.end_date || null,
            tag: newSchedule.tag || null,
            tagColor: newSchedule.tagColor || "#ff0000",
        };

        try {
            const result = await apiRequest("post", "/schedules", requestData);

            if (result) {
                console.log("✅ 일정이 성공적으로 추가되었습니다.");
                await fetchSchedulesByPage();
                window.dispatchEvent(new Event("scheduleAdded"));
                
                setIsAddingSchedule(false);
                onClose();
            } else {
                console.error("❌ 일정 추가 실패");
            }
        } catch (error) {
            console.error("❌ 일정 추가 실패:", error);
        }
    };

    // ✅ 일정 수정 핸들러
    const handleSave = () => {
        if (!editedSchedule.sid) return;

        onUpdate({
            ...editedSchedule,
            end_date: noEndDate ? null : editedSchedule.end_date,
        });
        setIsEditing(false);
    };

    // ✅ 입력 핸들러 (수정)
    const handleChange = (e) => {
        setEditedSchedule({ ...editedSchedule, [e.target.name]: e.target.value });
    };

    // if (!isOpen) return null;

    return ReactDOM.createPortal (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={`${styles.modalContent} ${pageLocked ? styles.locked : ""}`} onClick={(e) => e.stopPropagation()}>

                <div className={styles.modalButtonContainer}>
                    <button className={styles.closeButton} onClick={onClose}>✖</button>
                </div>

                {/* ✅ 일정 추가 폼 */}
                {isAddingSchedule ? (
                    <div className={styles.modalContainer}>
                        <div className={styles.modalHeader}>
                            <h2> add </h2>
                        </div>
                        <div className={styles.contentWrapper}>
                            <input type="text" placeholder="일정 제목" value={newSchedule.title} onChange={(e) => setNewSchedule({...newSchedule, title: e.target.value})} />
                            <textarea placeholder="설명 (선택)" value={newSchedule.description} onChange={(e) => setNewSchedule({...newSchedule, description: e.target.value})} />
                            <input type="datetime-local" value={newSchedule.start_date} onChange={(e) => setNewSchedule({...newSchedule, start_date: e.target.value})} required />

                            {!noEndDate && (
                                <input type="datetime-local" value={newSchedule.end_date} onChange={(e) => setNewSchedule({...newSchedule, end_date: e.target.value})} />
                            )}

                            <label className={`${styles.toggleSwitch} ${noEndDate ? styles.active : ""}`} onClick={() => setNoEndDate(!noEndDate)}>
                                <span>{noEndDate ? "" : "당일"}</span>
                                <div className={styles.toggleSlider}></div>
                            </label>

                            <input type="text" placeholder="ex) 업무, 운동, 개인일정, 여행" value={newSchedule.tag} onChange={(e) => setNewSchedule({...newSchedule, tag: e.target.value})} />

                            {newSchedule.tag && (
                                <div className={styles.colorPicker}>
                                    <label>🎨 색상 선택:</label>
                                    <input type="color" value={newSchedule.tagColor} 
                                            onChange={(e) => {
                                                const newColor = e.target.value;
                                                setNewSchedule({...newSchedule, tagColor: newColor});
                                                setTagColor(newSchedule.tag, newColor); 
                                            }} 
                                        />
                                    {/* <input type="color" value={newSchedule.tagColor} onChange={(e) => setNewSchedule({...newSchedule, tagColor: e.target.value})} /> */}
                                </div>
                            )}
                        </div>
                        <div className={styles.modalButtonContainer}>
                            <button onClick={handleAddSchedule}>추가</button>
                            <button onClick={() => setIsAddingSchedule(false)}>취소</button>
                        </div>
                    </div>
                ) : isEditing ? (
                    <>
                        {/* 📝 수정 폼 */}
                         <div className={styles.modalHeader}>
                             <h2> edit </h2>
                         </div>
                         <div className={styles.contentWrapper}>
                             <input type="text" name="title" value={editedSchedule.title} onChange={handleChange} disabled={pageLocked}/>
                             
                             <input type="datetime-local" name="start_date" value={editedSchedule.start_date} onChange={handleChange} disabled={pageLocked}/>
                             
                             {!noEndDate && (
                                 <input type="datetime-local" name="end_date" value={editedSchedule.end_date} onChange={handleChange} disabled={pageLocked}/>
                             )}

                             <label className={`${styles.toggleSwitch} ${noEndDate ? styles.active : ""}`} onClick={() => setNoEndDate(!noEndDate)} disabled={pageLocked}>
                                 <span>{noEndDate ? "" : "당일"}</span>
                                 <div className={styles.toggleSlider}></div>
                             </label>

                             <input type="text" name="tag" value={editedSchedule.tag}  placeholder="ex) 업무, 운동, 개인일정, 여행" onChange={handleChange} disabled={pageLocked}/>
                             <div className={styles.colorPicker}>
                            <label>🎨 </label>
                            <input 
                                type="color" 
                                value={editedSchedule.tagColor} 
                                onChange={(e) => {
                                    const newColor = e.target.value;
                                    setEditedSchedule({...editedSchedule, tagColor: newColor});
                                    setTagColor(editedSchedule.tag, newColor); // ✅ 태그 색상 저장
                                }} 
                            />
                        </div>
                             <textarea name="description" value={editedSchedule.description || "설명"} onChange={handleChange} disabled={pageLocked}/>
                         </div>
                         <div className={styles.buttonContainer}>
                             <button className={styles.saveButton} onClick={handleSave} disabled={pageLocked}>저장</button>
                             <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>취소</button>
                         </div>
                    </>
                ) : (
                    <>
                        {/* 📋 상세 폼 */}
                        <div className={styles.modalHeader}>
                            <h2>{schedule.title}</h2>
                        </div>
                        <div className={styles.contentWrapper}>
                            <p> {formatDateForDisplay(schedule.start_date)}</p>
                            {schedule.end_date && <p><strong> - </strong>{formatDateForDisplay(schedule.end_date)}</p>}
                            <strong>태그:</strong> 
                            <span style={{ color: getTagColor(schedule.tag), fontWeight: "bold" }}>
                                {schedule.tag || " "}
                            </span>
                            <p className={styles.createdAt}>📅 작성 시간: {formatDateForDisplay(schedule.created_at)}</p>
                            <div className={styles.descriptionSection}>
                                <p>{schedule.description || "수정을 눌러 설명을 채워넣으세요."}</p>
                            </div>
                        </div>
                        <div className={styles.modalButtonContainer}>
                            <button onClick={() => setIsEditing(true)}>수정</button>
                            <button onClick={() => onDelete(schedule.sid)}>삭제</button>
                        </div>
                    </>
                )}
            </div>
        </div>,
         document.body
    );
};

export default Modal;

// import React, { useState } from "react";
// import axios from "axios";
// import styles from "../styles/schedule.module.css";
// import { setTagColor } from "../utils/colorStorage";

// const ScheduleForm = ({ uid, setRefresh, darkMode, pageLocked }) => {
//     const [title, setTitle] = useState("");
//     const [description, setDescription] = useState("");
//     const [startDate, setStartDate] = useState("");
//     const [endDate, setEndDate] = useState("");
//     const [noEndDate, setNoEndDate] = useState(false);
//     const [tag, setTag] = useState("");
//     const [tagColor, setTagColorState] = useState("#6C757D");

   
//     const handleSubmit = async (e) => {
//         e.preventDefault();
        
//         if (!title || !startDate) {
//             alert("📌 필수 입력값을 모두 입력해주세요.");
//             return;
//         }

//         const requestData = {
//             uid,
//             title,
//             description: description || null, 
//             start_date: startDate,
//             end_date: noEndDate ? null : endDate || null, 
//             tag: tag || null, 
//         };

//         console.log("🔥 서버로 보낼 데이터:", requestData);

//         try {
//             await axios.post("http://localhost:5001/api/schedules", requestData);
//             setTagColor(tag, tagColor); // 태그 색상 저장
//             setRefresh(prev => !prev);
//              // 입력 필드 초기화
//              setTitle("");
//              setDescription("");
//              setStartDate("");
//              setEndDate("");
//              setNoEndDate(false);
//              setTag("");
//              setTagColorState("#6C757D");
//         } catch (error) {
//             console.error("❌ 일정 추가 실패:", error);
//         }
//     };

//     return (
//         <div className={`${styles.scheduleForm} ${darkMode ? "dark-mode-scheduleForm" : ""} ${pageLocked ? "page-locked" : ""}`}>
//             <h2>📝 일정 추가</h2>

//             <fieldset disabled={pageLocked} className={pageLocked ? styles.disabled : ""}>
//                 <form onSubmit={handleSubmit}>
//                     <input type="text" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
//                     <textarea placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} />
//                     <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
    
//                     {!noEndDate && (
//                         <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
//                     )}
    
//                     <label className={`${styles.toggleSwitch} ${noEndDate ? styles.active : ""}`} onClick={() => setNoEndDate(!noEndDate)}>
//                         <span>{noEndDate ? "" : "당일"}</span>
//                         <div className={styles.toggleSlider}></div>
//                     </label>    
    
//                     {/* 태그 입력 */}
//                     <input type="text" placeholder="태그 입력 (예: 업무, 운동, 개인일정, 여행)" value={tag} onChange={(e) => setTag(e.target.value)} />
    
//                     {/* 색상 선택 */}
//                     {tag && (
//                         <div className={styles.colorPicker}>
//                             <label>🎨 색상 선택:</label>
//                             <input type="color" value={tagColor} onChange={(e) => setTagColorState(e.target.value)} />
//                         </div>
//                     )}
    
//                     <button type="submit" className={styles.submitButton}>추가</button>
//                 </form>
//             </fieldset>
//         </div>
//     );
// };

// export default ScheduleForm;




import React, { useState } from "react";
import styles from "../styles/scheduleFormModal.module.css";

const ScheduleFormModal = ({ onClose, darkMode, pageLocked }) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [noEndDate, setNoEndDate] = useState(false);
    const [tag, setTag] = useState("");
    const [tagColor, setTagColorState] = useState("#ff0000");

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("📝 일정 추가됨:", { title, description, startDate, endDate, tag, tagColor });
        onClose(); // ✅ 폼 제출 후 닫기
    };

    return (
        <div className={styles.modalContainer}>
            <button className={styles.closeButton} onClick={onClose}>✖</button>
            <h2>📝 일정 추가</h2>

            <form onSubmit={handleSubmit}>
                <input type="text" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={pageLocked} />
                <textarea placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={pageLocked} />
                <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={pageLocked} />

                {!noEndDate && (
                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={pageLocked} />
                )}

                <label className={`${styles.toggleSwitch} ${noEndDate ? styles.active : ""}`} onClick={() => setNoEndDate(!noEndDate)}>
                    <span>{noEndDate ? "" : "당일"}</span>
                    <div className={styles.toggleSlider}></div>
                </label>

                <input type="text" placeholder="태그 입력 (예: 업무, 운동, 개인일정, 여행)" value={tag} onChange={(e) => setTag(e.target.value)} disabled={pageLocked} />

                {tag && (
                    <div className={styles.colorPicker}>
                        <label>🎨 색상 선택:</label>
                        <input type="color" value={tagColor} onChange={(e) => setTagColorState(e.target.value)} disabled={pageLocked} />
                    </div>
                )}

                <button type="submit" className={styles.submitButton} disabled={pageLocked}>추가</button>
            </form>
        </div>
    );
};

export default ScheduleFormModal;

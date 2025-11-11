import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePageContext } from "../components/PageContext";
import { deleteSchedule, updateSchedule, updateScheduleDrag  } from "../services/PageService";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import styles from "../styles/calendar.module.css";
import { getTagColor } from "../utils/colorStorage";
import Modal from "./Modal"; 

const CalendarView = ({ pageLocked }) => {
    //공통함수
    const { schedulesList = [], loadSchedules } = usePageContext(); 
    const { pid } = useParams(); 
    
    const [events, setEvents] = useState([]);
    const [tags, setTags] = useState([]); 
    const [selectedTag, setSelectedTag] = useState("all");
    const [selectedSchedule, setSelectedSchedule] = useState(null); 

     // ✅ 일정 불러오기 (페이지가 변경될 때마다 실행)
     useEffect(() => {
        if (pid) {
            loadSchedules(pid); 
        }
    }, [pid, loadSchedules]);

    // ✅ 일정 데이터 변환 (FullCalendar 형식으로 가공)
    useEffect(() => {
        if (!schedulesList.length) return;
        
        const formattedEvents = schedulesList.map((schedule) => ({
            id: schedule.sid,  
            title: schedule.title,
            start: schedule.start_date,
            end: schedule.end_date || schedule.start_date,
            description: schedule.description,
            backgroundColor: getTagColor(schedule.tag),
            borderColor: getTagColor(schedule.tag),
            textColor: "#fff",
            tag: schedule.tag,
            created_at: schedule.created_at,
        }));

        setEvents(formattedEvents);
        
        // 태그 목록 설정
        const uniqueTags = [...new Set(schedulesList.map((s) => s.tag).filter(Boolean))];
        setTags(uniqueTags);
    }, [schedulesList]);


    // ✅ 태그 필터 적용
    const filteredEvents = selectedTag === "all" ? events : events.filter((event) => event.tag === selectedTag);


    
    // ✅ 일정 클릭 시 모달 열기
    const handleEventClick = (info) => {
        setSelectedSchedule({
            sid: info.event.id,  
            title: info.event.title,
            start_date: info.event.start.toISOString(),
            end_date: info.event.end ? info.event.end.toISOString() : null,
            description: info.event.extendedProps.description || "",
            tag: info.event.extendedProps.tag || "",
            created_at: info.event.extendedProps.created_at || "",
        });
    };

    // ✅ 모달 닫기
    const closeModal = () => {
        setSelectedSchedule(null);
    };

   

    // ✅ 일정 수정 (공통 함수 사용)
    const handleUpdate = async (updatedSchedule) => {
        const sid = updatedSchedule.sid || selectedSchedule?.sid;
    
        if (!sid) {
            alert("❌ 일정 정보가 없습니다.");
            return;
        }
    
        try {
            await updateSchedule({ ...updatedSchedule, sid }); 
            loadSchedules(pid);
            closeModal();
            alert("✅ 일정이 수정되었습니다.");
        } catch (error) {
            console.error("❌ 일정 수정 실패:", error);
            alert("❌ 수정 중 오류 발생");
        }
    };

     // ✅ 일정 삭제 (공통 함수 사용)
     const handleDelete = async (sid) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await deleteSchedule(sid); 
            loadSchedules(pid); 
            closeModal();
            alert("✅ 일정이 삭제되었습니다.");
        } catch (error) {
            console.error("❌ 일정 삭제 실패:", error);
            alert("❌ 삭제 중 오류 발생");
        }
    };


    // mysql 날짜 변환
    const formatDateForMySQL = (isoString) => {
        const date = new Date(isoString);
        return date.toISOString().slice(0, 19).replace("T", " ");
    };
    
    // ✅ 일정 드래그로 날짜 변경 (공통 함수 사용)
    const handleDragAndDrop = async (info) => {
        const { id, start, end } = info.event;
        const sid = id; 
    
        try {
            const formatStartDate = formatDateForMySQL(start.toISOString());
            const formatEndDate = end ? formatDateForMySQL(end.toISOString()) : formatStartDate;
            console.log("📡 API 요청 실행: updateScheduleDrag");
            console.log("➡️ 요청 데이터:", { sid, formatStartDate, formatEndDate });

            await updateScheduleDrag(sid, formatStartDate, formatEndDate); // ✅ 올바른 공통 함수 사용
    
            setEvents((prevEvents) =>
                prevEvents.map((event) =>
                    event.id === sid
                        ? { ...event, start: formatStartDate, end: end ? formatEndDate : null }
                        : event
                )
            );
            alert("✅ 일정이 성공적으로 변경되었습니다.");
        } catch (error) {
            console.error("❌ 일정 변경 실패:", error);
            alert("❌ 일정 변경 중 오류 발생");
            info.revert()
        }
    };

   
 

    
    return (
        <div className={`${styles.calendarContainer} ${pageLocked ? "calendar-locked" : ""}`}>
            <div className={styles.filterContainer}>
                <label>태그:</label>
                <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                    <option value="all">전체</option>
                    {tags.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
            </div>
    
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-6">
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]} 
                initialView="dayGridMonth"
                headerToolbar={{
                    left: "today,dayGridMonth",
                    center: "title",
                    right: "prev,next",
                }}
                dragScroll={false}
                eventDragMinDistance={1}
                eventStartEditable={true} 
                eventResizableFromStart={true} 
                events={filteredEvents}
                eventContent={(eventInfo) => {
                    const tag = eventInfo.event.extendedProps.tag; 
                    const tagColor = getTagColor(tag);
                
                    return (
                        <span 
                            className="fc-event-title" 
                            style={{ color: tagColor, fontWeight: "bold" }}
                        >
                            {eventInfo.event.title}
                        </span>
                    );
                }}
                editable={!pageLocked}
                eventDrop={(info) => {
                    if (!pageLocked) {
                        handleDragAndDrop(info);
                    } else {
                        info.revert();
                        alert("🔒 페이지가 잠겨있습니다.");
                    }
                }}
                eventClick={handleEventClick}
            />
            </div>

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
        </div>
    );
};

export default CalendarView;
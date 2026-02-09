import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
    fetchPages, fetchSchedulesByPage, //페이지
    fetchTrashPages, // 휴지통
    fetchBlocks,
    addBlock, //블럭
} from "../services/PageService"; 
import { useAuth } from "./AuthContext";

const PageContext = createContext(); 
export const usePageContext = () => useContext(PageContext); 

export const PageProvider = ({ children }) => {
    const { isAuthed, isCurrentUser } = useAuth();
    // const uid = localStorage.getItem("uid");
    const uid = isCurrentUser?.uid ?? null; 
    const [pages, setPages] = useState([]);  // 페이지 목록
    const [schedulesList, setSchedulesList] = useState([]);  // 일정 목록
    const [trashList, setTrashList] = useState([]);  // 휴지통 목록
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [blocks, setBlocks] = useState([]); // 블럭 목록 
    const [sync, setSync] = useState(0);
    
    /** API 중복 호출 방지용 ref */
    const isTrashLoading = useRef(false); // 휴지통
    const initGuardRef = useRef(false); // 초기 로딩 블록 생성 
    const initOnceRef = useRef(false);

    /* 초기 로딩시 빈 화면일 때 블록 한 개 추가 */
    const initializeContent = useCallback(async () => {
        if (initOnceRef.current) return;
            initOnceRef.current = true;
            try {
                const latest = await fetchBlocks(); 

                if (Array.isArray(latest) && latest.length > 0) {
                    setBlocks(latest);
                    initOnceRef.current = true;
                    return;
                }
                const firstBlock = await addBlock("text", "", 1000);
                
                if (firstBlock?.reloadedBlocks) setBlocks(firstBlock.reloadedBlocks);
                else if (firstBlock) setBlocks([firstBlock]);

                initOnceRef.current=true;
            } catch (err) {
                console.error("❌ [initializeContent] 실패:", err);
            }
    }, []);

    /** 페이지 목록 불러오기 */
    const loadPages = useCallback(async () => {
        if (!uid) return;
        const data = await fetchPages(uid);
        setPages(data);
    }, [uid]);

    /** 특정 페이지의 일정 목록 불러오기 (페이지 클릭 시 실행) */
    const loadSchedules = useCallback(async (pid) => {
        if (!uid || !pid) return;
        const data = await fetchSchedulesByPage(uid, pid);
        setSchedulesList(data);
    }, [uid]);

    /** 휴지통 목록 불러오기 (휴지통 열릴 때 실행) */
    const loadTrashPages = useCallback(async () => {
        if (!uid || isTrashLoading.current) return;
        isTrashLoading.current = true;
        console.log("📢 [loadTrashPages] 실행");
        const data = await fetchTrashPages(uid);
        setTrashList(data ?? []);
        setTimeout(() => {
            isTrashLoading.current = false;  //일정 시간 후 다시 호출 가능
        }, 500); // 0.5초 동안 중복 호출 방지
    }, [uid]);

    // 블록 목록 불러오기
    const loadBlocks = useCallback(async () => {
        if (!isAuthed || !uid) {
            setBlocks([]);
            return;
        }

        const res = await fetchBlocks();
        if (Array.isArray(res) && res.length > 0 ) {
            setBlocks(res);
        } else {
            // 블록 한 개 추가
            await initializeContent();
            console.log("📢 [loadBlocks] 초기화면 블록 0: 블록 추가 완료");
        }
    }, [isAuthed, uid, initializeContent]);

    /** 최초 앱 로드 시 실행 (페이지 목록만 불러옴) */
    useEffect(() => {
         if (!isAuthed || !uid) {
            setPages([]);
            setSchedulesList([]);
            setTrashList([]);
            setBlocks([]);
            initGuardRef.current = false;
            return;
        }
        // if (!uid) return;
        loadPages();
        loadBlocks();
    }, [isAuthed, uid, loadPages, loadBlocks]);

    /** 페이지 변경 감지 → 목록 자동 갱신 */
    useEffect(() => {
        if (!isAuthed || !uid) return;
        // if (!uid) return;
        const handlePageUpdated = async () => {
            await loadPages();
        };
        const pageEvents = [
            "pageAdded",
            "pageTitleUpdated",
            "pageDuplicated",
            "pageMovedToTrash",
            "pageRestored",
            "pagePermanentlyDeleted",
        ];
        pageEvents.forEach((eventType) => {
            window.addEventListener(eventType, handlePageUpdated);
        });
        return () => {
            pageEvents.forEach((eventType) => {
                window.removeEventListener(eventType, handlePageUpdated);
            });
        };
    }, [isAuthed, uid, loadPages]);

   /** 휴지통 변경 감지 → 목록 자동 갱신 (한 번만 실행) */
    useEffect(() => {
         if (!isAuthed || !uid) return;
        // if (!uid) return;
        const handleTrashUpdated = async () => {
            if (!isTrashLoading.current) {
                // console.log("📢 [휴지통 변경 감지]");
                await loadTrashPages();
            }
        };
        window.addEventListener("trashUpdated", handleTrashUpdated);

        return () => {
            window.removeEventListener("trashUpdated", handleTrashUpdated);
        };
    }, [isAuthed, uid, loadTrashPages]);

    /* 블록 변경 감지 */
    useEffect(() => {
        let t = null;
        const onBlocksChanged = (e) => {
        if (e?.detail?.source === "editor-local") return;
        if (t) return;
        t = setTimeout(async () => {
            t = null;
            await loadBlocks();
        }, 120);
        };
        window.addEventListener("blocks:changed", onBlocksChanged);
        return () => {
        window.removeEventListener("blocks:changed", onBlocksChanged);
        if (t) clearTimeout(t);
        };
    }, [loadBlocks]);
    
    return (
        <PageContext.Provider value={{
            pages, loadPages, // 페이지 
            schedulesList, loadSchedules, // 일정
            trashList, loadTrashPages, // 휴지통
            isModalOpen, setIsModalOpen, // 모달
            blocks, setBlocks, loadBlocks, // 블록
            sync, setSync // 서버 싱크
        }}>
            {children}
        </PageContext.Provider>
    );
};

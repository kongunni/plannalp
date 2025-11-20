import axios from "axios";

/* 
 * 공통 API 요청 함수 
*/

// API URL
const BASE_URL = process.env.REACT_APP_BACKEND_URL
    ? `${process.env.REACT_APP_BACKEND_URL}/api`
    : "http://localhost:5001/api";

// API 요청시 동적으로 엔드포인트 입력받도록 설정
export const apiRequest = async (method, endpoint, data = null) => {
    try {
        const url = `${BASE_URL}${endpoint}`;

        const config = {
            method,
            url,
        };

        if (method.toLowerCase() === "get") {
            config.params = data; // GET은 params에 넣어야 함
        } else {
            config.data = data; // POST, PUT 등은 data에 넣음
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`❌ API 요청 실패 (${method.toUpperCase()} ${endpoint})`, error);
        return null;
    }
};

/** 🔥 [1] 페이지 목록 가져오기 */
export const fetchPages = async (uid) => {
    if (!uid) return [];
    const response = await apiRequest("get", `/pages`, { uid }); 
    return response?.pages ?? [];
};

/** 🔥 [2] 스케줄 페이지 목록 가져오기 */
export const fetchSchedulePages = async (uid) => {
    if (!uid) return [];
    return await apiRequest("get", `/schedules/pages?uid=${uid}`);
};

/** 🔥 [3] 특정 페이지 정보 가져오기 */
export const fetchPageDetails = async (pid) => {
    if (!pid) return null;
    return await apiRequest("get", `/pages/${pid}`);
};


/** 🔥 [2] :pid 페이지의 일정 목록 가져오기 */
export const fetchSchedulesByPage = async (uid, pid) => {
    if (!uid || !pid) return [];
    const response = await apiRequest("get", `/schedules/pages/${pid}?uid=${uid}`);
    return response?.schedules ?? [];
};


/** 🔥 [3] 일정 추가 */
export const addSchedule = async (scheduleData) => {
    return await apiRequest("post", "/schedules", scheduleData);
};

/** 🔥 [4] 일정 상세 조회 (모달) */
export const fetchScheduleDetails = async (sid) => {
    if (!sid) return null;
    return await apiRequest("get", `/schedules/${sid}`);
};

/** 🔥 [5] 일정 수정 */
export const updateSchedule = async (updatedSchedule) => {
    return await apiRequest("put", `/schedules/${updatedSchedule.sid}`, updatedSchedule);
};

/** 🔥 [6] 일정 삭제 */
export const deleteSchedule = async (sid) => {
    return await apiRequest("delete", `/schedules/${sid}`);
};

/** 🔥 [7] 일정 드래그로 날짜 변경 */
export const updateScheduleDrag = async (sid, start_date, end_date) => {
    if (!sid) throw new Error("❌ 일정 ID(sid)가 없습니다.");
    console.log("📡 API 요청 실행: PATCH /schedules/" + sid);
    console.log("➡️ 요청 데이터:", { start_date, end_date });
   
    return await apiRequest("patch", `/schedules/${sid}`, { start_date, end_date });
};





/** 🔥 [4] 특정 스케줄 페이지 정보 가져오기  이거 고민좀 */
export const fetchSchedulePageDetails = async (pid) => {
    if (!pid) return null;
    return await apiRequest("get", `/schedules/pages/${pid}`);
};

/** 🔥 [5] 새 페이지 추가 */
// export const addPage = async (uid, title, loadPages) => {
//     if (!uid || !title.trim()) return null;
//     const result = await apiRequest("post", `/pages`, { uid, title: title.trim() });
//     if (result) {
//         console.log("📢 페이지 제목 변경 완료! 목록 다시 불러옴");
//         await loadPages(); 
//     }
//     return result;
// };
export const addPage = async (uid, title) => {
    if (!uid || !title.trim()) return null;
    const result = await apiRequest("post", `/pages`, { uid, title: title.trim() });

    if (result?.success) {
        console.log("✅ 새 페이지 추가 성공");
        window.dispatchEvent(new Event("pageAdded")); // 이벤트 활용
        return result;
    } else {
        console.warn("❌ 페이지 추가 응답 실패 또는 비정상:", result);
        return null;
    }
};

/** 🔥 [6] 새 스케줄 페이지 추가 */
// export const addSchedulePage = async (uid, title) => {
//     if (!uid || !title.trim()) return null;
//     return await apiRequest("post", `/schedules/pages`, { uid, title: title.trim() });
// };

/** 🔥 [7] 페이지 이름 변경 */
export const renamePage = async (pid, newTitle, loadPages) => {
    if (!pid || !newTitle.trim()) return false;
    const result = await apiRequest("put", `/pages/rename`, { pid, newTitle: newTitle.trim() });

    if (result) {
        console.log("[page service] 📢 페이지 제목 변경 완료! 목록 다시 불러옴");
        window.dispatchEvent(new Event("pageTitleUpdated"));
    }
    return result;
};

/** 🔥 [8] 페이지 복제 */
export const duplicatePage = async (uid, pid) => { 
    if (!uid || !pid) return null;

    try {
        const result = await apiRequest("post", `/pages/duplicate`, { uid, originalPid: pid });

        if (result) {
            console.log("📢 페이지 복제됨! 목록 다시 불러옴");
            window.dispatchEvent(new Event("pageDuplicated"));
        }

        return result;
    } catch (error) {
        console.error("❌ 페이지 복제 실패:", error);
        return null;
    }
};


/** 🔥 [9] 페이지 삭제 (휴지통 이동) */
export const moveToTrash = async (pid) => {
    if (!pid) return false;

    const result = await apiRequest("patch", `/pages/delete`, { pid });
    if (result) {
        console.log("📢 페이지가 휴지통으로 이동됨! 목록 다시 불러옴");
        window.dispatchEvent(new Event("pageMovedToTrash")); // ✅ 휴지통 이동 이벤트 발생
    }
    return result;
};

/** 🔥 [10] 휴지통에서 페이지 복원 */
export const restorePage = async (pid) => {
    if (!pid) return false;
    
    const result = await apiRequest("patch", `/pages/restore`, { pid });
    if (result) {
        console.log("📢 페이지 복원 완료! 목록 다시 불러옴");
        await fetchTrashPages(localStorage.getItem("uid"));
        window.dispatchEvent(new Event("pageRestored")); 
        window.dispatchEvent(new Event("trashUpdated")); 
    }
    return result;
};

/** 🔥 [11] 페이지 완전 삭제 */
export const deletePagePermanently = async (pid) => {
    if (!pid) return false;
    const result = await apiRequest("delete", `/pages/${pid}`);
    if (result) {
        console.log("📢 페이지 완전 삭제 완료! 목록 다시 불러옴");
        window.dispatchEvent(new Event("pagePermanentlyDeleted"));
        window.dispatchEvent(new Event("trashUpdated")); 
    }
    return result;
};

/** 🔥 [12] 휴지통 목록 조회 */
export const fetchTrashPages = async (uid) => {
    if (!uid) return [];

    try {
        
        console.log(`📢 [fetchTrashPages] 요청 URL: /trash?uid=${uid}`);
        const response = await apiRequest("get", `/trash?uid=${uid}`);
        console.log("📢 [fetchTrashPages] 응답 데이터:", response);
        return response?.pages ?? [];
    } catch (error) {
        console.error(`❌ 휴지통 API 요청 실패 (GET /pages/trash?uid=${uid})`, error);

        // ✅ 404 (Not Found)일 경우 빈 배열 반환
        if (error.response?.status === 404) {
            console.warn("⚠️ [휴지통 조회] 404: 데이터 없음 (빈 배열 반환)");
            return [];
        }

        return [];
    }
};



/** 🔥 [13] 30일 이상 지난 페이지 자동 삭제 */
export const autoDeleteTrashPages = async () => {
    return await apiRequest("delete", `/pages/trash/auto-delete`);
};

/** 🔥 [14] 사이드바 즐겨찾기 추가/해제 */
export const switchFavorite =  async (pid, isFavorite) => {
    if (!pid) return false;
    const result = await apiRequest("patch", `/pages/favorite`, { pid, isFavorite });
    if (result) {
        console.log(`📢 페이지 즐겨찾기 ${isFavorite ? "추가" : "제거"} 완료! 목록 다시 불러옴`);
        window.dispatchEvent(new Event("pageFavoriteUpdated"));
    }
    return result;
};


/** 🔥 [14] 콜아웃 조회 */
export const fetchCallout = async(uid, pid = null) => {
    if (!uid) return null;

    const endpoint = pid
        ? `/pages/${pid}/callout/${uid}`  // 상세 페이지
        : `/schedule/callout/${uid}`;     // 스케줄 페이지

    return await apiRequest("get", endpoint);
};

/** 🔥 [15] 콜아웃 추가 또는 수정 */
export const saveCallout = async(uid, pid, callout) => {
    if (!uid) return false;

    const endpoint = pid
        ? `/pages/${pid}/callout/add`   // 상세 페이지
        : `/schedule/callout/add`;      // 스케줄 페이지

    const result = await apiRequest("post", endpoint, { uid, pid, callout });

    if (result) {
        console.log("📢 콜아웃 저장 완료! 즉시 반영됨");
        window.dispatchEvent(new Event("calloutUpdated"));
    }
    return result;
};

/** 🔥 [16] 드래그앤드롭으로 페이지 목록 순서 이동 */
export const updatePageOrder = async (pagesOrder) => {
    try {
        const response = await apiRequest("PUT", "/pages/order", { pages: pagesOrder });
        return response.data;
    } catch (error) {
        console.error("❌ 페이지 순서 업데이트 실패:", error);
        return null;
    }
};


/*
   노션기능 따라잡기
*/

// 리인덱싱 발생 시 블럭 조회
async function handleReindexResult(res) {
  if (res?.reindexed) {
    const blocks = await fetchBlocks();
    return { ...res, reloadedBlocks: blocks };
  }
  return res;
}

// ===================================
// 스케쥴 페이지
// ===================================
const safeParse = (s) => { try { return JSON.parse(s) } catch { return {} } };
/* [1]  블록 목록 조회 - 전체 */
// export const fetchBlocks = async () => {
//     const response = await apiRequest("get", `/block`);
//     return (response ?? []).sort((a, b) => a.order_index - b.order_index);
// };
export const fetchBlocks = async () => {
  const response = await apiRequest("get", `/block`);
  const list = Array.isArray(response) ? response : (response?.blocks ?? []);
  const normalized = list.map(b => ({
    ...b,
    meta: typeof b.meta === "string" ? safeParse(b.meta) : (b.meta || {})
  }));
  return normalized.sort((a,b)=>(a.order_index??0)-(b.order_index??0));
};


/* [1]  블록 목록 조회 - 단일 */
export const fetchBlockById = async (bid) => {
    return await apiRequest("get", `/block/${bid}`);
};


/* [2] 블록 추가(1000단위 간격 적용) */
export const addBlock = async (type = "text", content = "", order_index,checked) => {
    try {
        const response = await apiRequest("post", "/block", {type, content, order_index, checked, });
        return handleReindexResult(response);
    } catch (err) {
        console.error("[page service] addBlock 에러: ", err);
        return null;
    }
};

// export const addBlock = async (type = "text", content = "", order_index) => {
//     try {
//       const response = await apiRequest("post", "/block", { type, content, order_index });
  
//       // 리인덱싱 발생 시 전체 블록 재로드
//       if (response?.reindexed) {
//         console.log("⚠️ 리인덱싱 발생 → 전체 블록 재로드");
//         const blocks = await fetchBlocks();
//         return { ...response, reloadedBlocks: blocks };
//       }
  
//       return response;
//     } catch (err) {
//       console.error("❌ addBlock 에러", err);
//       return null;
//     }
// };


/* [3]  블록 리인덱싱 : 순서 재정렬 */
export const reindexBlocks = async () => {
    const response = await apiRequest("post", "/block/reindex");
    if (response?.success) {
    const blocks = await fetchBlocks();
    console.log("✅ 블록 리인덱싱 완료:", response);
    return { ...response, reloadedBlocks: blocks };
  }
  return response;
};
// export const reindexBlocks = async () => {
//     try {
//       const response = await apiRequest("post", `/block/reindex`);
//       console.log("✅ 블록 리인덱싱 완료:", response);
//       return response;
//     } catch (err) {
//       console.error("❌ 블록 리인덱싱 실패:", err);
//       return null;
//     }
// };

/* [4]  블록 내용 수정 */
export const updateBlockContent = async (bid, content ) => {
    try {
        const filtered = content === "/" || content === "\u200B" ? "" : content;
        const data = { bid, content: filtered };
        const response = await apiRequest("put", `/block/content`, data);
        return response;
    } catch (err) {
      console.error("❌ updateBlockContent 실패:", err);
      return null;
    }
  };

/* [5]  블록 타입 업데이트 */
export const updateBlockType = async (bid, type) => {
    try {
        const response = await apiRequest("put", `/block/type`, { bid, type });
        return response.data;
    } catch (error) {
      console.error("블록 타입 업데이트 실패", error);
      throw error;
    }
};

/* [6] 체크박스 토글용  */
export const toggleBlockChecked = async (bid, checked) => {
  return await apiRequest("put", "/block/checked", { bid, checked: !!checked });
};

/* [7]  블럭 삭제 */
export const deleteBlock = async (bid) => {
    try{
        const response = await apiRequest("delete", `/block/${bid}`);
        return response;
    } catch(err) {
        console.error("블록 삭제 실패", err);
        throw err;
    }
};


/* [8] 블럭 순서 재정렬 prev, next 값 기반 */
export const updateBlockOrder =async (bid, prevOrder, nextOrder) => {
    try {
        const response = await apiRequest("patch", "/block/order", { bid, prevOrder, nextOrder });
        return handleReindexResult(response);
    } catch (error) {
        console.error("[page service] updateBlockOrder ⚠️ failled ... : ", error );
        return null;
    }
};

/* [9] 블럭 순서 재정렬 prev, next 근처 id 기반 */
export const reorderBlock =async (bid, prevBid, nextBid) => {
    try {
        const response = await apiRequest("post", "/block/reorder", { bid, prevBid, nextBid });
        return handleReindexResult(response);
    } catch (error) {
        console.error("[page service] updateBlockOrder ⚠️ failled ... : ", error );
        return null;
    }
};

/** [10] 배치 재정렬 */
export const reorderBlocksBatch = async (orderedBids) => {
    const items = orderedBids.map((bid) => ({ bid }));
    const response = await apiRequest("post", "/block/reorder/batch", { items });
    const blocks = await fetchBlocks();
    return { ...response, reloadedBlocks: blocks };
};


/** [11] 콜아웃 */
export const updateCallout = async (bid, patch /* {mode?, color?, iconId?} */) => {
  const res = await apiRequest("put", `/block/callout`, { bid, ...patch });
  const block = res?.block ?? res ?? null;
  if (block && typeof block.meta === "string") block.meta = safeParse(block.meta);
  return block;
};


/*
1. 할 일 블록 생성
/할 일, /todo 명령어로 할 일(To-do) 블록 생성

2. 키보드 인터랙션
Enter: 다음 할 일 항목 자동 생성
Enter 2번 : 할일목록 종료되면서 다른 블록으로 이동(다음 줄 생성(현재 블록 뒤에 새로운 블록 생성))
Backspace: 비어있는 항목 제거

3. 드래그로 순서 변경
마우스로 항목 드래그해 순서 재배치 가능

4. 할 일 완료 표시
체크 시 취소선으로 표시되어 직관적으로 완료 상태 확인 가능

각 "할 일"은 블록 단위로 저장되며, 서브 체크 항목은 계층적 구조를 가짐
완료 여부는 내부적으로 checked: true | false 형태로 저장됨
실시간으로 변경 내용이 저장되어 협업 환경에서도 동기화됨

*/
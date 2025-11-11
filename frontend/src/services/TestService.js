import axios from "axios";

const BASE_URL = process.env.REACT_APP_BACKEND_URL
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : "http://localhost:5001/api";

/** 공통 요청 함수  
 * 에러 발생 시 에러를 throw함.
 */
const apiRequest = async (method, endpoint, data = null) => {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const response = await axios({ method, url, data });
    return response.data;
  } catch (err) {
    console.error(`❌ API 실패 (${method.toUpperCase()} ${endpoint})`, err);
    throw err;
  }
};

/** 🔹 [GET] 블록 목록 조회 */
export const fetchBlocks = async (bid) => {
  if (!bid) return [];
  const response = await apiRequest("get", `/schedule-blocks?bid=${bid}`);
  return response ?? [];
};

/** 🔹 [POST] 블록 추가 */
/*
  수정사항:
  - orderIndex가 제공되지 않으면, fetchBlocks(bid)를 호출하여 현재 존재하는 블록들의
    order_index 중 최댓값+1을 사용.
  - duplicate entry 에러가 발생할 경우, 재시도 로직을 통해 order_index를 다시 계산하고 재시도.
*/
export const addBlock = async (bid, type, orderIndex) => {
    // orderIndex가 제공되지 않았다면 동적으로 계산합니다.
    if (orderIndex === null || orderIndex === undefined) {
      const currentBlocks = await fetchBlocks(bid);
      orderIndex =
        currentBlocks && currentBlocks.length > 0
          ? Math.max(...currentBlocks.map((b) => b.order_index)) + 1
          : 0;
    }
    
    let maxRetry = 3;
    while (maxRetry--) {
      try {
        const response = await apiRequest("post", `/schedule-blocks`, {
          bid,
          type,
          content: "",
          order_index: orderIndex,
        });
        return response;
      } catch (error) {
        // 수정: duplicate 에러를 error.code를 통해 확인합니다.
        if (
          (error.code && error.code === "ER_DUP_ENTRY") ||
          (error.message && error.message.includes("Duplicate entry")) ||
          (error.response &&
            error.response.data &&
            typeof error.response.data === "string" &&
            error.response.data.includes("Duplicate entry"))
        ) {
          // 재조회 후 order_index 재계산합니다.
          const currentBlocks = await fetchBlocks(bid);
          orderIndex =
            currentBlocks && currentBlocks.length > 0
              ? Math.max(...currentBlocks.map((b) => b.order_index)) + 1
              : 0;
          // 재시도 루프 계속
          continue;
        }
        throw error;
      }
    }
    throw new Error("Failed to add block after retries due to duplicate entries");
  };
  

/** 🔹 [PUT] 블록 내용 수정 */
export const updateBlockContent = async (bid, orderIndex, newContent) => {
  const response = await apiRequest("put", `/schedule-blocks/content`, {
    bid,
    order_index: orderIndex,
    content: newContent,
  });
  return response;
};

/** 🔹 [PUT] 블록 순서 변경 */
export const updateBlockOrder = async (blocks) => {
  const response = await apiRequest("put", `/schedule-blocks/order`, { blocks });
  return response;
};

/** 🔹 [DELETE] 블록 삭제 */
export const deleteBlock = async (bid, orderIndex) => {
  const response = await apiRequest(
    "delete",
    `/schedule-blocks?bid=${bid}&order_index=${orderIndex}`
  );
  return response?.success ?? false;
};

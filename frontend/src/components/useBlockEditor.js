import { useState, useRef, useEffect, useCallback } from "react";
import { 
        addBlock, updateBlockContent, deleteBlock, updateBlockType, 
        fetchBlocks, reindexBlocks, toggleBlockChecked,
        updateCallout
        } from "../services/PageService";

const useBlockEditor = (blocks, setBlocks ) => {
  // const isAddingBlock = useRef(false); // 블럭위치
  const editorRefs = useRef({});// 수정할 블럭위치
  const pendingFocusBidRef = useRef(null); // 포커스 이동 예약
  const isBlockEnd = useRef(false); // 문단 끝 위치 : divider이 맨 마지막에 위치할 때 사용
  const suppressTailOnceRef = useRef(false); // 문단 끝 위치한 블록 추가 끄기

  const draftRef = useRef({}); // { [bid]: string } 콜아웃 전용 드래프트
  const saveTimerRef = useRef({}); // { [bid]: number } 디바운스 타이머
  const composingRef = useRef(false); //IME 판정용
  const enterOnceRef = useRef(false); //엔터 판정용
  const isAddingBlockRef = useRef(false); // 블럭 추가 중복 방지

  const [focusedIndex, setFocusedIndex] = useState(null); // 드롭다운 포커스
  const [inputValue, setInputValue] = useState("");
  const [isCommandActive, setIsCommandActive] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null); 
  const [commandPos, setCommandPos] = useState({ top: 0, left: 0 }); // 드롭다운

  
// const saveTimeout = useRef(null); // 입력 감지시 자동저장

  const blockCommands = [
      { type: "title1", label: "/제목1" },
      { type: "title2", label: "/제목2" },
      { type: "title3", label: "/제목3" },
      { type: "checklist", label: "/할 일 목록" },
      { type: "callout", label: "/콜아웃" },
      { type: "toggle", label: "/토글" },
      { type: "quote", label: "/인용" },
      { type: "divider", label: "/구분선" },
      { type: "page", label: "/페이지" },
  ];

// 노션 타입
const getBlockClass = (type) => {
   switch (type) {
    case "title1":
      return "block-title1";
    case "title2":
      return "block-title2";
    case "title3":
      return "block-title3";
    case "checklist":
      return "block-checklist"; 
    case "callout":
      return "block-callout";
    case "quote":
      return "block-quote";
    case "divider":
      return "block-divider";
    default:
      return "block-text";
  }
};



/* ==========================================
 *                   공통함수  
   ========================================== */

const resolveIndex = (index, e) => {
  // 1) e가 있으면 data-bid 우선
  const bidStr = e?.currentTarget?.dataset?.bid;
  const bid = bidStr ? Number(bidStr) : NaN;
  if (Number.isFinite(bid)) {
    const i = blocks.findIndex(b => b.bid === bid);
    return i; // 못 찾으면 -1
  }
  // 2) fallback: 기존 index가 범위 안이면 사용
  if (Number.isInteger(index) && index >= 0 && index < blocks.length) return index;
  return -1;
};

// 순서재정렬 
const sortByOrder = (arr = []) => {
  return [...arr].sort((a, b) => {
    const ao = a?.order_index ?? Number.POSITIVE_INFINITY;
    const bo = b?.order_index ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    const ac = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bc = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (ac !== bc) return ac - bc;
    return String(a?.bid ?? "").localeCompare(String(b?.bid ?? ""));
  });
};

// 블록 정렬 후 상태 반영
const normalizeAndSetBlocks = useCallback((next) => {
  // next가 함수(updater)든 배열이든 처리
  if (typeof next === "function") {
    setBlocks((prev) => sortByOrder(next(prev)));
  } else {
    setBlocks(sortByOrder(next));
  }
}, [setBlocks]);

// 편집 내부인지 확인용
const getSafeRange = (rootEl) => {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!rootEl || !rootEl.contains(range.startContainer)) return null;
  return range;
};

// 텍스트 정규화 (br제거)
const normalizeText = (text) => (text || "")
                                            .replace(/\u200B/g, "")   // zero-width space
                                            .replace(/\u00A0/g, " ")  // &nbsp;
                                            .trim();

// 비어있는 텍스트 감지
// const isVisuallyEmpty = (el) => {
//   if (!el) return true;
//   const text = normalizeText(el.innerText || "");
//   return text.length === 0;
// };

// 보이는 문자만 남기기
const stripInvisible = (s) =>
  (s ?? "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/&nbsp;|&#160;/gi, "")
    .replace(/\r/g, "")
    .trim();

// caret 뒤에 실질 텍스트/요소가 남아있는지(끝인지)
const isCaretAtEnd = (rootEl) => {
  const sel = window.getSelection?.();
  if (!rootEl || !sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (!rootEl.contains(r.endContainer)) return false;

  const post = document.createRange();
  post.selectNodeContents(rootEl);
  post.setStart(r.endContainer, r.endOffset);
  // BR 들은 줄 경계일 뿐, 후속 줄 텍스트가 없으면 끝으로 간주한다.
  const txt = stripInvisible(post.toString());
  return txt.length === 0;
};

//오프셋 기반으로 안정화
const getCurrentLineText = (el) => {
  if (!el) return "";
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return "";
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return "";
  // 커서까지의 가시 텍스트 길이
  const offset = getCaretTextOffset(el); // 이미 가지고 계신 함수
  const full = el.innerText || "";
  // 현재 줄 시작 인덱스(없으면 0)
  const lineStart = full.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  // 현재 줄 텍스트 = [줄 시작 ~ 커서]
  const line = full.slice(lineStart, offset);
  return stripInvisible(line);
};

// 커서가 블록 끝에 있는지
const isCaretAtBlockEnd = (el) => isCaretAtEnd(el);

// 커서 뒤 텍스트(가시 기준) 확인 유틸
// const getAfterText = (el) => {
//   const sel = window.getSelection?.();
//   if (!el || !sel || sel.rangeCount === 0) return "";
//   const r = sel.getRangeAt(0);
//   if (!el.contains(r.endContainer)) return "";

//   const pre = document.createRange();
//   pre.selectNodeContents(el);
//   pre.setStart(r.endContainer, r.endOffset);
//   return stripInvisible(pre.toString());
// };


/*
 * 블록 업데이트 유틸
 */

// 블록 타입 & 콘텐츠 업데이트 (서버 및 상태 동시 업데이트)
const updateTypeAndContent = async (bid, index, type, content="") => {
  await updateBlockType(bid, type);
  await updateBlockContent(bid, content);
  const updated = [ ...blocks ];
  updated[index] = { ...updated[index], type, content };
  normalizeAndSetBlocks(updated);
};

// setBlocks 로컬 상태 업데이트 
const updateBlockLocally = useCallback((index, changes) => {
  normalizeAndSetBlocks((prev) => {
    if (!Array.isArray(prev)) return prev;
    if (index < 0 || index >= prev.length) return prev;
    const next = [...prev];
    next[index] = { ...next[index], ...changes };
    return next;
  });
}, [normalizeAndSetBlocks]);

// 리인덱싱 : 순서 재정렬
const calculateOrderIndex = async (index) => {
  const prevOrder = blocks[index]?.order_index ?? 1000;
  const nextOrder = blocks[index + 1]?.order_index ?? prevOrder + 1000;
  let newOrder = Number(((prevOrder + nextOrder) / 2).toFixed(6));

  if (nextOrder - prevOrder < 0.0001) {
    console.warn("⚠️ 간격 부족 → 리인덱싱 시도");
    await reindexBlocks();
    const refreshed= await fetchBlocks();
    normalizeAndSetBlocks(refreshed);
    const refreshedPrev = refreshed[index]?.order_index ?? 1000;
    const refreshedNext = refreshed[index + 1]?.order_index ?? refreshedPrev + 1000;
    newOrder = Number(((refreshedPrev + refreshedNext) / 2).toFixed(6));
  }
  return newOrder;
};


// 리인덱싱 후 전체 Fetch처리
const safeAddBlock = async (type = "text", content = "", order_index, checked) => {
  const result = await addBlock(type, content, order_index, checked);
  if (result?.reloadedBlocks && result?.bid != null) {
    const list = sortByOrder(result.reloadedBlocks);
    const newBlock = list.find(b => b.bid === result.bid) || null;
    return { block: newBlock, reloadedBlocks: list };
  }
  const newBlock = result?.block ?? result ?? null;
  if (newBlock && order_index != null && newBlock.order_index == null) {
    newBlock.order_index = order_index;
  }
  return { block: newBlock, reloadedBlocks: null };
};

// ================================================
// 블록 추가후 처리
// ================================================

const insertTextBlockAfter = async (index) => {
  const newOrder = await calculateOrderIndex(index);
  const { block: newBlock, reloadedBlocks } = await safeAddBlock("text", "", newOrder);
  if (!newBlock) return null;

  if (reloadedBlocks) {
    normalizeAndSetBlocks(reloadedBlocks); // 이미 정렬됨
  } else {
    normalizeAndSetBlocks(prev => { 
      const before = prev.slice(0, index + 1);
      const after  = prev.slice(index + 1);
      return [...before, newBlock, ...after]; 
    });
  }
  pendingFocusBidRef.current = newBlock.bid;
  return newBlock;
};

// 콜아웃, 토글, 인용 등 사용 : 줄바꿈 <br>
const insertBreak = (el) => {
  const range = getSafeRange(el);
  if (!range) return;

  const br = document.createElement("br");
  range.insertNode(br);

  // 줄 끝에서 줄바꿈이면 크롬/WebKit에서 캐럿이 줄 뒤로 못 가는 현상 방지
  const atBlockEnd = isCaretAtBlockEnd(el);
  if (atBlockEnd) {
    const zw = document.createTextNode("\u200B");
    range.setStartAfter(br);
    range.collapse(false);
    range.insertNode(zw);
    range.setStartAfter(zw);
  } else {
    range.setStartAfter(br);
    range.collapse(true);
  }

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

// const insertBreak = (el) => {
//   const range = getSafeRange(el);
//   if (!range) return;

//   const br = document.createElement("br");
  
//   // 커서 포커싱
//   range.insertNode(br);
//   range.setStartAfter(br);
//   range.collapse(true);

//   const sel = window.getSelection();
//   sel.removeAllRanges();
//   sel.addRange(range);
// };

// 체크리스트 : 엔터시 새 항목 추가
const insertChecklistAfter = async (index) => {
  const newOrder = await calculateOrderIndex(index);
  const { block: newBlock, reloadedBlocks } = await safeAddBlock("checklist", "", newOrder);
  if (!newBlock) return null;

  if (reloadedBlocks) {
    normalizeAndSetBlocks(reloadedBlocks);
  } else {
    normalizeAndSetBlocks(prev => {
      const before = prev.slice(0, index + 1);
      const after  = prev.slice(index + 1);
      return [...before, newBlock, ...after];
    });
  }
  pendingFocusBidRef.current = newBlock.bid;
  return newBlock;
};

// 텍스트 블록 추가 : 더블엔터 시 처리 : 토글, 인용, 콜아웃 등

// 콜아웃 외곽 클릭 시 포커스
const handleCalloutContainerClick = (e, index) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  // 설정창 클릭시 강제 포커스 이동 방지
  if (
    target.closest(".callout-icon") ||
    target.closest(".callout-menu-trigger") ||
    target.closest(".co-swatch") ||
    target.closest(".co-icon-btn")
  )  return; 

  
  const bid = blocks[index]?.bid;
  const editable = editorRefs.current[bid];
  if (!editable) return;

  // 본문을 클릭했는지 이중 판정
  if (target.closest('.editable') || editable.contains(target)) {
    return;
  }

  e.preventDefault();
  focusAndPlaceCaretEnd(editable);
};


// 커맨드드롭 종료
const closeCommandDropdown = () => {
  setIsCommandActive(false);
  setFilteredCommands([]);
  setSelectedCommandIndex(0);
};

//type: "divider", label: "/구분선" 
const handleMouseEnter = (index) => { setHoveredIndex(index); };
const handleMouseLeave = () => { setHoveredIndex(null); };

// 텍스트 입력 감지 후 2초뒤 자동 저장 
const debounceUpdateContent = (bid, value, delay = 2000) => {
  if (!bid) return;
  if (saveTimerRef.current[bid]) clearTimeout(saveTimerRef.current[bid]);

  saveTimerRef.current[bid] = setTimeout(async () => {
    try {
      await updateBlockContent(bid, value);
      normalizeAndSetBlocks(prev => {
        const idx = prev?.findIndex?.(b => b.bid === bid);
        if (idx == null || idx < 0) return prev;
        if (prev[idx]?.content === value) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], content: value };
        return next;
      });
    } finally {
      delete saveTimerRef.current[bid];
    }
  }, delay);
};

/* ==========================================
*            포커스/캐럿 유틸 + 네비게이션
========================================== */
// 커서가 contentEditable 내부에서 몇 글자인지 계산
const getCaretTextOffset = (rootEl) => {
  const range = getSafeRange(rootEl);
  if (!range) return 0;
  // text 시작부터 커서까지 길이 구하기
  const preRange = document.createRange();
  preRange.selectNodeContents(rootEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

// 시작/끝 여부 판정
const getCaretOffsets = (rootEl) => {
  const range = getSafeRange(rootEl);
  if (!range) {
    return { atStart: false, atEnd: false, length: rootEl?.innerText?.length ?? 0 };
  }

  const pre = document.createRange();
  pre.selectNodeContents(rootEl);
  pre.setEnd(range.startContainer, range.startOffset);
  const beforeLen = pre.toString().length;

  const post = document.createRange();
  post.selectNodeContents(rootEl);
  post.setStart(range.endContainer, range.endOffset);

  const afterLen = post.toString().length;
  const totalLen = (rootEl.innerText || "").length;
  return { atStart: beforeLen === 0, atEnd: afterLen === 0, length: totalLen };
};

// 문단 끝에 포커싱
const focusAndPlaceCaretEnd = useCallback((el) => {
  if (!el || !document.body.contains(el)) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}, []);

const focusBlockEnd = (bid) => {
  const el = editorRefs.current[bid];
  if (el) focusAndPlaceCaretEnd(el);
};

const focusBlockStart = (bid) => {
  const el = editorRefs.current[bid];
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

// 편집기능 블록 인덱스 찾기
const isEditableBlock = (b) => b && b.type !== "divider";

// 이전 인덱스 찾기
const findPrevEditableIndex = (from) => {
  for (let i = from - 1; i >= 0; i--) 
    if (isEditableBlock(blocks[i])) 
      return i;
  return null;
};

// 다음 인덱스 찾기
const findNextEditableIndex = (from) => {
  for (let i = from + 1; i < blocks.length; i++) 
    if (isEditableBlock(blocks[i])) return i;
  return null;
};

// 문단의 끝 : divider가 맨 마지막에 . 위치시 블록 추가하여 편집가능하도록
const appendAfterDivider = async () => {
  if (suppressTailOnceRef.current) return;
  if (!Array.isArray(blocks) || blocks.length === 0) return;

  const last = blocks[blocks.length - 1];
  if (!last || last.type !== "divider") return;

  try {
    isBlockEnd.current = true;
    const newOrder = await calculateOrderIndex(blocks.length - 1);
    const { block: newBlock, reloadedBlocks } = await safeAddBlock("text", "", newOrder);
    if (!newBlock) return;
    if (reloadedBlocks) {
      normalizeAndSetBlocks(reloadedBlocks);
    } else {
      normalizeAndSetBlocks((prev) => [...prev, newBlock]);
    }  
   window.dispatchEvent(new CustomEvent("blocks:changed", {
      detail: { reason: "normalize-tail", newBid: newBlock.bid, source: "editor-local" }
    }));
  } catch (err) {
    console.error("[normalizeTailIfNeeded] 실패:", err);
  } finally {
    isBlockEnd.current = false;
  }
};

// 체크리스트 컨테이너 클릭: 체크박스가 아닌 곳을 클릭하면 에디터에 포커스
const handleChecklistContainerClick = (e, index) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.tagName === "INPUT") return;
  if (target.closest('.editable')) return;

  const bid = blocks[index]?.bid;
  const el = editorRefs.current[bid];
  if (el) {
    focusAndPlaceCaretEnd(el);
  }
};

// 커서 아래 좌표 계산
const updateCommandPosition = () => {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    // 커서 바로 아래에 붙이기
    setCommandPos({
      top: rect.bottom + window.scrollY + 4, 
      left: rect.left + window.scrollX,
    });
  } catch (e) {}
};

/* ===========================
    콜아웃
=========================== */

//색상 설정 모드 
const setCalloutColor = useCallback(async (index, mode, color) => {
  // 서버 업데이트
  const target = blocks?.[index];
  const bid = target?.bid;
  if (!bid || target.type !== "callout") return;
  await updateCallout(bid, { mode, color });
  // 로컬 반영 (함수형)
  normalizeAndSetBlocks(prev => {
    if (!prev?.[index]) return prev;
    const before = prev[index];
    const nextMeta = {
      ...(before.meta || {}),
      callout: { ...(before.meta?.callout || {}), mode, color }
    };
    const next = [...prev];
    next[index] = { ...before, meta: nextMeta };
    return next;
  });
}, [normalizeAndSetBlocks, blocks]);
 
//아이콘 설정 모드
const setCalloutIcon = useCallback(async (index, iconId) => {
  const target = blocks?.[index];
  if (!target || target.type !== "callout") return;
  if (!Number.isInteger(iconId) || iconId < 0 || iconId > 9) return;
  await updateCallout(target.bid, { iconId });
  normalizeAndSetBlocks(prev => {
    if (!prev?.[index]) return prev;
    const before = prev[index];
    const nextMeta = {
      ...(before.meta || {}),
      callout: { ...(before.meta?.callout || {}), iconId }
    };
    const next = [...prev];
    next[index] = { ...before, meta: nextMeta };
    return next;
  });
}, [normalizeAndSetBlocks, blocks]);

// 콜아웃 저장 디바운스
const debounceSaveCallout = useCallback((bid, value, delay = 500) => {
  if (saveTimerRef.current[bid]) clearTimeout(saveTimerRef.current[bid]);
  saveTimerRef.current[bid] = setTimeout(async () => {
    try {
      await updateBlockContent(bid, value);

      normalizeAndSetBlocks(prev => {
        const idx = prev?.findIndex?.(b => b.bid === bid);
        if (idx == null || idx < 0) return prev;
        if (prev[idx]?.content === value) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], content: value };
        return next;
      });

    } finally {
      delete saveTimerRef.current[bid];
    }
  }, delay);
}, [normalizeAndSetBlocks]);


// 외부에서 필요하면 드래프트 조회
const getDraftContent = useCallback((bid) => draftRef.current[bid] ?? null, []);


// 스크롤/리사이즈에도 위치 재계산
useEffect(() => {
  const onScrollOrResize = () => { if (isCommandActive) updateCommandPosition(); };
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
  return () => {
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize);
  };
}, [isCommandActive]);

// 블록 변화 감지시 문단의 끝 보정작업
useEffect(() => {
  appendAfterDivider();
// eslint-disable-next-line 
}, [blocks]);

// 문단나누기 : 블록분리, 이어쓰기, 명령후 이어쓰기 등 사용
const splitBlockAtCursor = async (index) => {
  const block = blocks[index];
  if (!block) return null;
  
  const el = editorRefs.current[block.bid];
  if (!el) return null;

  const fullText = el.innerText || "";
  const cursorPos = getCaretTextOffset(el);
  const before = fullText.slice(0, cursorPos);
  const after  = fullText.slice(cursorPos);

  try {
    // 1) 현재 블록 before 저장
    await updateBlockContent(block.bid, before);
    if(el.innerText !== before) 
      el.innerText = before;

    // 2)새 블록 생성 (after를 내용으로)
    const newOrder = await calculateOrderIndex(index);
    const { block: newBlock, reloadedBlocks } = await safeAddBlock("text", after, newOrder);
    if (!newBlock) return null;
    
    // 3) 로컬 상태 반영
    if (reloadedBlocks) {
      normalizeAndSetBlocks(reloadedBlocks);
    } else {
      const updated = [
        ...blocks.slice(0, index + 1),
        { ...newBlock, content: after },
        ...blocks.slice(index + 1),
      ];
      normalizeAndSetBlocks(updated);
    }

    // 4) 커서 포커스 추가된 블록 끝으로
    requestAnimationFrame(() => {
      const nextEl = editorRefs.current[newBlock.bid];
      if (nextEl) focusAndPlaceCaretEnd(nextEl);
    });
    return newBlock;
  } catch (err) {
     console.error("[splitBlockAtCursor] 실패:", err);
      return null;
  }

};


//  블록 복제
const handleDuplicateBlock = async (index) => {
  const src = blocks[index];
  if (!src) return;

  // 원본 바로 아래에 들어오도록 order_index 계산
  const newOrder = await calculateOrderIndex(index);

  // 체크리스트면 checked 상태까지 그대로 복제
  const type    = src.type;
  const content = src.content ?? "";
  const checked = type === "checklist" ? !!src.checked : undefined;

  // 새 블록 생성(서버 + 상태)
  const { block: newBlock, reloadedBlocks } = await safeAddBlock(type, content, newOrder, checked);
  if (!newBlock) return;
  if (reloadedBlocks) {
    normalizeAndSetBlocks(reloadedBlocks);
  } else {
    const updated = [
      ...blocks.slice(0, index + 1),
      { ...newBlock, content, checked },
      ...blocks.slice(index + 1),
    ];
    normalizeAndSetBlocks(updated);
  }

  // 포커스는 새 블록 끝으로
  requestAnimationFrame(() => {
    const el = editorRefs.current[newBlock.bid];
    if (el) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  });

  window.dispatchEvent(new CustomEvent("blocks:changed", {
    detail: { reason: "duplicate", srcBid: src.bid, newBid: newBlock.bid }
  }));
};


/* ******************************************************** */
/*
*  드롭다운 명령어 포커스
*/
const handleFocus = (e, index) => {
  
  pendingFocusBidRef.current = null;

  const bid = blocks[index]?.bid;
  const el = e.currentTarget;

  // 이미 포커싱 중인 블록 포커싱 중복 방지
  if (focusedIndex === index && document.activeElement === el) {
    return;
  }
  console.log("[handleFocuse] 감지된 인덱스:  ", index);
  setFocusedIndex(index);

  if (bid) {
    editorRefs.current[bid] = el;
  }

  if (blocks[index]?.type === "callout" && el) {
    el.dataset.lastEmptyEnter = "0";
  };

  const targetBlock = blocks.length > 0 ? blocks[index] : { content: "" };
  if (targetBlock && targetBlock.content === "당신의 일정을 채워보세요.") {
    e.currentTarget.innerText = "";
    const updated = [...blocks];

    if (updated[index]) {
      updated[index].content = "";
      normalizeAndSetBlocks(updated);
    }
  }

};


/*
 * 명령어 입력 감지, 블록 컨텐트 업데이트 
 */
const handleInputChange = (e, index) => {
  const idx = resolveIndex(index, e);
  if (idx < 0) return;

  // undefined 케이스 방지
  const el = e?.currentTarget;
  if (!el) return;

  const value = e.currentTarget.innerText;
  const block = blocks[idx];
  if (!block) return;
  const bid = block.bid;
  const type = e.currentTarget.dataset.type || "text";

  // 2) 명령어 감지
  if (type === "text" && value.startsWith("/")) {
    setIsCommandActive(true); 
    setFocusedIndex(idx);
    setFilteredCommands( blockCommands.filter((cmd) => cmd.label.startsWith(value)) );
    updateCommandPosition();
  } else {
    setIsCommandActive(false); // 명령어 드롭다운 닫기
    setFilteredCommands([]);
  }

  // 2) 콜아웃 드래프트 + 콜아웃용 디바운스 저장만
  if (type === "callout") {
    const editable = e.currentTarget;
    if (stripInvisible(editable.innerText) !== "" ) {
      editable.dataset.lastEmptyEnter = "0";
    }
    
    draftRef.current[bid] = value;
    debounceSaveCallout(bid, value);
    return; 
  }
  // 3) 그외 일반 블록 프론트 상태 업데이트 + bid기반 디바운스 저장
  updateBlockLocally(idx, { content: value });
  debounceUpdateContent(bid, value);
};

/* 
 *  포커스 아웃시 DB 업데이트
 */
const handleBlur = async (index, content, lid = null) => {
  const block = blocks[index];
  if (!block) return;
  const bid = block.bid;
  const type = block.type;
  const filtered = (content === "/" || content === "\u200B") ? "" : content;

  // 콜아웃: 확정 저장 및 드래프트제거
  if (type === "callout") {
    try {
      // 남아있는 디바운스 취소하고 즉시 저장
      if (saveTimerRef.current[bid]) {
        clearTimeout(saveTimerRef.current[bid]);
        delete saveTimerRef.current[bid];
      }
      await updateBlockContent(bid, filtered);
      if (block.content !== filtered) {
        updateBlockLocally(index, { content: filtered });
      }
    } finally {
      delete draftRef.current[bid];
    }
    return;
  }

  // 일반 블록일 경우
  if (content !== filtered) {
    try {
      await updateBlockContent(bid, filtered);
      console.log("✅ 블록 콘텐츠 업데이트 완료:", bid);
    } catch (err) {
      console.error("❌ 블럭 업데이트 실패:", err);
    }
  }
};

 // 체크리스트 체크/해제
const handleChecklistToggle = async (index, checked) => {
  const block = blocks[index];
  const type = block.type;
  const bid = block.bid;
  if (!block || type !== "checklist") return;
  // UI 즉시 반영
  updateBlockLocally(index, { checked: !!checked });
  try {
    await toggleBlockChecked(bid, !!checked);
  } catch (e) {
    console.error("체크 토글 실패", e);
    // 실패 시 롤백
    updateBlockLocally(index, { checked: !checked });
  }
};


/* 
 *  키타입 감지
 */

// 콜아웃 즉시 저장
const flushCalloutNow = async (bid, el, idx) => {
  const v = (el?.innerText ?? "").toString();

  // 1) 콜아웃 저장 타이머 제거
  if (saveTimerRef.current[bid]) {
    clearTimeout(saveTimerRef.current[bid]);
    delete saveTimerRef.current[bid];
  }

  // 2) 로컬 state 즉시 반영 (유령 방지 핵심)
  updateBlockLocally(idx, { content: v });

  // 3) 서버 즉시 반영
  try {
    await updateBlockContent(bid, v);
  } catch (err) {
    console.error("[flushCalloutNow] 서버 저장 실패", err);
  }
};


// 키 처리
  const handleKeyDown = async (e, index) => {
    const idx = resolveIndex(index, e);
    if (idx < 0) return;

    const block = blocks[idx];
    if (!block) return;

    const bid = block.bid;
    const type = block.type;
    const el = e.currentTarget;

    if (e.isComposing || composingRef.current) return;

    const range = getSafeRange(el);
    if (!range) {
      // 포커스가 엘리먼트 밖인 상태에서 키가 들어온 케이스 방지
      if (document.activeElement !== el) {
        el.focus();
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      // range 값 구해서 없으면 종료
      const fixed = getSafeRange(el);
      if (!fixed) return;

      return;
    }

    // 1) 드롭다운 활성: ↑/↓는 드롭다운 항목 이동
    if (isCommandActive) {
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          e.key === "ArrowDown"
            ? (prev + 1) % filteredCommands.length
            : (prev - 1 + filteredCommands.length) % filteredCommands.length
        );
        setTimeout(updateCommandPosition, 0);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[selectedCommandIndex];
        if (cmd) {
          await handleCommandSelect(cmd, idx);
          return;
        }
      }
    }

    // 2) 드롭다운 비활성: ↑/↓로 블록 네비게이션 (divider 스킵)
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const { atStart, atEnd, length } = getCaretOffsets(el);

      if (e.key === "ArrowUp" && (atStart || length === 0)) {
        const prevIdx = findPrevEditableIndex(idx);
        if (prevIdx !== null) {
          e.preventDefault();
          focusBlockEnd(blocks[prevIdx].bid);
          return;
        }
      }
      if (e.key === "ArrowDown" && (atEnd || length === 0)) {
        const nextIdx = findNextEditableIndex(idx);
        if (nextIdx !== null) {
          e.preventDefault();
          focusBlockStart(blocks[nextIdx].bid);
          return;
        }
      }
      // 문장 중간이면 기본 커서 이동에 맡김
    }

    // 3) Backspace
    const selection = window.getSelection();
    const cursorPos = selection?.getRangeAt(0)?.startOffset ?? 0;
    
    // 선택영역이 있으면 무시
    if (!getSafeRange(el)) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(r) };
    }
    // 앞 블록과 병합
    if (e.key === "Backspace") {
      
      let fullText = el.innerText || "";
      let isEmpty = normalizeText(fullText).length === 0;
      // let isEmpty = fullText.trim() === "";

      // 1) 콜아웃
      if (type === "callout") {
        if (isEmpty) {
          e.preventDefault();
          await handleBackspace(e, idx);
          return;
        }
      }

      // 2) 구분선이 맨 앞을 포커싱하고 있고 윗 블록이 구분선 블록일 떄 삭제
      if (cursorPos === 0 && idx > 0 && blocks[idx - 1]?.type === "divider") {
        e.preventDefault();
        const dividerBid = blocks[idx - 1].bid;
        try {
          await deleteBlock(dividerBid);
          normalizeAndSetBlocks((prev) => prev.filter((b) => b.bid !== dividerBid));
        } catch (err) {
          console.error("[divider 삭제 실패] ", err);
        }
        return;
      }

      //3) 앞블록과 병합
      if (cursorPos === 0 && fullText.trim() !== "" && idx > 0) {
        e.preventDefault();
        await mergeWithPreviousBlock(idx);
        return;
      }
      // 4) 빈 블록 삭제
      if (normalizeText(fullText).length === 0) {
        handleBackspace(e, idx);
        return;
      }
    }

    // 4) Enter
    if (e.key === "Enter") {

      /*
       * shift + Enter 처리 
       * 근데 현재 설계상 Shift+Enter는 줄바꿈이면 그냥 기본 브라우저 동작을 쓰는 편이 안전 --> 나중에 고쳐야지
       */
      if (e.shiftKey) {
        if (type === "callout" || type === "toggle" || type === "quote") {
          e.preventDefault();
          
          if (type === "callout") {
            await flushCalloutNow(bid, el, idx);
          }
          await insertTextBlockAfter(idx);
          return
        }

        // 2) 일반 텍스트: 줄바꿈 유지
        if (type === "text") {
          insertBreak(el);
          debounceUpdateContent(bid, (el.innerText ?? ""));
          return;
        }
        return;
      }

      /*
       * 기본 Enter 처리
       */
      e.preventDefault();
      e.stopPropagation();
      
      // 이중처리 방지
      if (enterOnceRef.current) return;
      enterOnceRef.current = true;

      // 블록 추가/분기 처리 락으로 잠금
      if (isAddingBlockRef.current) {
        setTimeout(() => { enterOnceRef.current = false; }, 0);
        return;
      }
      isAddingBlockRef.current = true;
      
      try {
        // 1) 콜아웃
        if (type === "callout") {
          const full = stripInvisible(el.innerText || "");
          // 전체가 비어있으면 종료
          if (full=== "") {
            await flushCalloutNow(bid, el, idx); 
            await insertTextBlockAfter(idx);
            return;
          }

          // (B) 현재 줄이 비어있고 블록 끝에 포커싱 되어있을 때 탈출
          const lineText = stripInvisible(getCurrentLineText(el));

          if (lineText === "") {
            await flushCalloutNow(bid, el, idx);
            await insertTextBlockAfter(idx);
            return;
          }
          
          // 아니면 내부 줄바꿈
          insertBreak(el);
          debounceSaveCallout(bid, el.innerText, 2000);
          return;
        } // if end

        // 2) 토글 
        if (["toggle", "quote"].includes(type)) {
          const fullText = el.innerText || "";
          const plain = fullText.replace(/\n/g, "").trim();
          const isEmptyText = el.dataset.lastEmptyEnter === "1";

          if (isEmptyText && plain === "") {
            // 더블엔터: 종료
            // e.preventDefault();
            el.dataset.lastEmptyEnter = "0";
            await insertTextBlockAfter(idx);
            return;
          } 

          el.dataset.lastEmptyEnter = plain === "" ? "1" : "0";
          // 싱글 엔터: 같은 블록 내부 줄바꿈
          // e.preventDefault();
          return;
        }

        // 3) 체크리스트
        if (type === "checklist") {
          // e.preventDefault();
          const fullText = el.innerText || "";
          const plain = fullText.replace(/\n/g, "").trim();
          const isEmptyText = el.dataset.lastEmptyEnter === "1";
          
          // 1) 내용 있는 상태에서 Enter : 새 항목 추가
          if ( plain !== "") {
            await updateBlockContent(bid, fullText.trim());
            el.dataset.lastEmptyEnter = "0";
            await insertChecklistAfter(idx);
            return;
          }

          // 2) 더블 엔터: 빈 줄에서  Enter
          if (isEmptyText) {
            el.dataset.lastEmptyEnter = "0";
            await updateTypeAndContent(bid, idx, "text", "");
            requestAnimationFrame(() => {
              const current = editorRefs.current[bid];
              current && focusAndPlaceCaretEnd(current);
            });
            return;
          }
          // 3) 그 외: 첫번째 빈 엔터 플래그세팅
          el.dataset.lastEmptyEnter = "1";
          return;
        }

        // 4) 제목
        if (["title1", "title2", "title3"].includes(type)) {
          await insertTextBlockAfter(idx);
          return;
        }

        // 5) 나머지 일반 텍스트 블록: 커서 기준으로 블록 split
        await splitBlockAtCursor(idx);
        return;

      } finally {
        setTimeout(() => { enterOnceRef.current = false; }, 0);
        isAddingBlockRef.current = false;
      }
    }
  };


// 기존 블럭 수정 (명령어 선택 시 블록 타입 변경 + 서버 반영)
const handleCommandSelect = async (cmd, index) => {
  console.log("[handleCommandSelect] 1 진입. 명령어: ", cmd, "index:", index);

  const block = blocks[index];
  const bid = block.bid;
  const el = bid ? editorRefs.current[bid] : null ;
  if (!block || !bid || !el) return;

  el.innerText = "";
  closeCommandDropdown();

  switch (cmd.type) {
    case "checklist": {
      updateBlockLocally(index, { type: "checklist", content: "", checked: false});
      await updateTypeAndContent(bid, index, "checklist", "");
      focusAndPlaceCaretEnd(el);
      break;
    }

    case "divider": {
      await handleDividerInsert(index);
      return;
    }
    case "title1":
    case "title2":
    case "title3":
    case "callout":
    case "toggle":
    case "quote":
    case "text":
    default: {
      updateBlockLocally(index, { type: cmd.type, content: "" });
      await updateTypeAndContent(bid, index, cmd.type, "");
      focusAndPlaceCaretEnd(el);
      setTimeout(() => {
        const updatedEl = editorRefs.current[bid];
        updatedEl && focusAndPlaceCaretEnd(updatedEl);
      }, 0);
      break;
    }
  }
};

// 백스페이스시 블록 삭제
const handleBackspace = async (e, index) => {
  const block = blocks[index];
  const bid = block.bid;

  // 블록이 하나 남았을 때는 삭제하지 않고 초기화
  if (blocks.length === 1) {
    await updateTypeAndContent(bid, index, "text", "");
    normalizeAndSetBlocks([{ ...block, type: "text", content: "" }]);
    return;
  }
  // 2) 삭제 전에 포커스 넘겨줄 대상의 bid 계산
  const prevIdx = (() => {
    for (let i = index - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b && b.type !== "divider") return i;
    }
    return null;
  })();
  const prevBid = prevIdx != null ? blocks[prevIdx].bid : null;

  // 3) 서버 삭제
  await deleteBlock(bid);

  // 4) 로컬 상태에서 해당 bid 제거 + 정렬
  normalizeAndSetBlocks((prev) => prev.filter((b) => b.bid !== bid));
  
  // 5) 다음 프레임에서 prevBid 기준으로 포커스 이동
  requestAnimationFrame(() => {
    if (!prevBid) return;

    const el =
      editorRefs.current[prevBid] ||
      document.querySelector(`.editable[data-bid="${prevBid}"]`);

    if (el) {
      focusAndPlaceCaretEnd(el);
    }
  });
 
};

  // 병합 : 현재 블록을 바로 앞의 블록과 합침 (두 블록을 하나로 합쳐 업데이트)
  const mergeWithPreviousBlock = async (currentIndex) => {
    if (currentIndex === 0) return;

    const current = blocks[currentIndex];
    const previous = blocks[currentIndex - 1];
    const mergedContent = `${previous.content}${current.content}`;

    // 1) 서버에 병합된 내용 업데이트
    await updateBlockContent(previous.bid, mergedContent);
    await deleteBlock(current.bid);

    // 2)로컬 상태 업데이트
    const updated = blocks.map((b, i) => {
      if (i === currentIndex - 1) return { ...b, content: mergedContent };
      if (i === currentIndex) return null;
      return b;
    }).filter(Boolean);
    normalizeAndSetBlocks(updated);

    // 3) 화면에 즉시 병합된 내용 반영
  requestAnimationFrame(() => {
    const prevBid = previous.bid;
    const targetEl =
      editorRefs.current[prevBid] ||
      document.querySelector(`.editable[data-bid="${prevBid}"]`);

    if (targetEl) {
      targetEl.innerText = mergedContent;
      focusAndPlaceCaretEnd(targetEl);
    }
  });
  };

  /*
    handleCommandSelect 공통처리
  */
  // 명령어 : 구분선
  const handleDividerInsert = async(index) => {
    try {
      const currentIndex = blocks[index];
      if (!currentIndex) return;

      const bid = currentIndex.bid;
      suppressTailOnceRef.current = true; 

      // 1) 현재 블록 구분선으로 변경 후 명령어 제거
      await updateTypeAndContent(bid, index, "divider", "");
      // 2) divider 바로 아래에 빈 text 블록 추가
      const textOrder = await calculateOrderIndex(index);

      // 3)
      const { block: textBlock, reloadedBlocks } = await safeAddBlock("text", "", textOrder);
    

      if (!textBlock) return;
      if (reloadedBlocks) {
        normalizeAndSetBlocks(reloadedBlocks);
      } else {
        normalizeAndSetBlocks((prev) => {
          const i = prev.findIndex((b) => b.bid === bid);
          if (i < 0) return prev;
          return [...prev.slice(0, i + 1), textBlock, ...prev.slice(i + 1)];
        });
      }

      // 4)추가된 새 블록 포커스 
      requestAnimationFrame(() => {
        const el = editorRefs.current[textBlock.bid];
        if (el) {
          el.focus();
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(true);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        }
      });
      // 5) 이벤트 호출
      window.dispatchEvent(new CustomEvent("blocks:changed", {
        detail: { reason: "divider-insert", dividerBid: bid, textBid: textBlock.bid, source: "editor-local" }
      }));
    } catch (err) {
      console.error("[handleDividerInsert] 실패:", err);
    } finally {
      requestAnimationFrame(() => { suppressTailOnceRef.current = false; });
    }
  };

  return {
    // state
    inputValue, setInputValue,
    isCommandActive, setIsCommandActive,
    filteredCommands, setFilteredCommands,
    selectedCommandIndex, setSelectedCommandIndex,
    // handlers
    handleInputChange,
    handleBlur,
    handleKeyDown,
    handleCommandSelect,
    handleDividerInsert,
    handleChecklistToggle,
    handleChecklistContainerClick,
    handleDuplicateBlock,
    handleCalloutContainerClick,
    // utils
    executeCommand: addBlock,
    getBlockClass,
    hoveredIndex, handleMouseEnter, handleMouseLeave,
    handleFocus,
    focusedIndex, setFocusedIndex,
    editorRefs,
    pendingFocusBidRef,
    focusAndPlaceCaretEnd,
    splitBlockAtCursor,
    commandPos,
    composingRef,
    // callout 설정
    setCalloutColor,
    setCalloutIcon,
    getDraftContent,
  };
};
export default useBlockEditor;












// const handleKeyDown = async (e, index) => {
//   const block = blocks[index];
//   if (!block) return;

//   const bid = block.bid;
//   const type = block.type;
//   const el = e.currentTarget;
//   const fullText = el.innerText || "";

//   const selection = window.getSelection();
//   const cursorPos = selection?.getRangeAt(0)?.startOffset ?? 0;

//   // 명령어 드롭다운 활성 중
//   if (isCommandActive) {
//     if (["ArrowDown", "ArrowUp"].includes(e.key)) {
//       e.preventDefault();
//       setSelectedCommandIndex((prev) =>
//         e.key === "ArrowDown"
//           ? (prev + 1) % filteredCommands.length
//           : (prev - 1 + filteredCommands.length) % filteredCommands.length
//       );
//       setTimeout(updateCommandPosition, 0);
//       return;
//     }
//     if (e.key === "Enter") {
//       e.preventDefault();
//       const cmd = filteredCommands[selectedCommandIndex];
//       if (cmd) {
//         await handleCommandSelect(cmd, index);
//         return;
//       }
//     }
//   }


//   // ⌫ 백스페이스 병합 or 삭제
//   if (e.key === "Backspace") {
//     // 1. 체크리스트 항목 삭제

//     // 1. 일반 블록 : 앞 블록과 병합
//     if (cursorPos === 0 && fullText.trim() !== "" && index > 0) {
//       e.preventDefault();
//       await mergeWithPreviousBlock(index);
//       return;
//     }
//     // 2. 빈블록 제거
//     if (fullText.trim() === "") {
//       handleBackspace(e, index);
//       return;
//     }
//   }

//   //  Enter 입력 처리
//   if (e.key === "Enter") {
//     e.preventDefault();

//     // 1. 제목 명령어 → 다음 블록은 일반 텍스트로 분리
//     if (["title1", "title2", "title3"].includes(type)) {
//       const newBlock = await splitBlockAtCursor(index);
//       if (newBlock) {
//         await updateTypeAndContent(newBlock.bid, index+1, "text", newBlock.content);
       
//          setBlocks((prev) => {
//           const newIndex = prev.findIndex((b) => b.bid === blocks[index].bid);
//           const updated = [
//             ...prev.slice(0, newIndex + 1),
//             { ...newBlock, type: "text" },
//             ...prev.slice(newIndex + 1),
//           ];
//           return updated;
//         });
//       }
//       return;
//     }

//     // 2. 토글 / 콜아웃 / 인용 → 첫 번째 Enter: 줄바꿈, 두 번째 Enter: 새 블록
//     if (["callout", "toggle", "quote"].includes(type)) {
//       const now = Date.now();
//       const prev = parseInt(el.dataset.lastEnter || "0");
//       el.dataset.lastEnter = now;

//       if (now - prev < 500) {
//         // 두 번째 Enter → splitBlockAtCursor 후 새 블록을 text로
//         await insertNewBlockAfter(index);
//         const newBlock = blocks[index + 1];
//         if (newBlock) {
//           await updateTypeAndContent(newBlock.bid, index + 1, "text", newBlock.content);
//           updateBlockLocally(index + 1, { type: "text" });
//         }
//       } else {
//         // 첫 번째 Enter는 줄바꿈
//         document.execCommand("insertHTML", false, "<br>");
//       }
//       return;
//     }

//     // 3. 체크리스트
//     if (type === "checklist") {
//       const text = fullText.trim();

//       try {
//         await updateBlockContent(bid, text);
//         updateBlockLocally(index, { content: text });
//       } catch (error) {
//         console.error("[front] checklist 저장실패: ", error);
//       }

//       if (text === "") {
//         // 빈 텍스트일 때 enter시 checklist 종료 : text블록으로 전환
//         await updateTypeAndContent(bid, index, "text", "");
//         requestAnimationFrame(() => {
//           const current = editorRefs.current[bid];
//           current && focusAndPlaceCaretEnd(current);
//         });
//         return;
//       }

//       // 내용 있을 때 enter시 아랫줄에 새 checklist 추가
//       const newOrder = await calculateOrderIndex(index);
//       const newBlock = await safeAddBlock("checklist", "", newOrder, false);
      
//       if (newBlock) {
//         const updated = [
//             ...blocks.slice(0, index + 1),
//             newBlock,
//             ...blocks.slice(index + 1),
//         ];
//         setBlocks(updated);
        
//         requestAnimationFrame(() => {
//           const nextEl = editorRefs.current[newBlock.bid];
//           nextEl?.focus();
//         });
//       }
//       return;
//     }
//     // 4. 기본 블록 → 분할 처리
//     await splitBlockAtCursor(index);
//   }
// };
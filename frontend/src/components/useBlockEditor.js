import { useState, useRef, useEffect, useCallback } from "react";
import { 
        addBlock, updateBlockContent, deleteBlock, updateBlockType, 
        fetchBlocks, reindexBlocks, toggleBlockChecked,
        updateCallout
        } from "../services/PageService";

const useBlockEditor = (blocks, setBlocks ) => {
  // const isAddingBlock = useRef(false); // 블럭위치
  const editorRefs = useRef({});// 수정할 블럭위치
  const pendingFocusBidRef = useRef(null);
  const isBlockEnd = useRef(false); // 문단 끝 위치 : divider이 맨 마지막에 위치할 때 사용
  const suppressTailOnceRef = useRef(false); // 문단 끝 위치한 블록 추가 끄기

  const draftRef = useRef({});             // { [bid]: string } 콜아웃 전용 드래프트
  const saveTimerRef = useRef({});         // { [bid]: number } 디바운스 타이머


  const [focusedIndex, setFocusedIndex] = useState(null); // 드롭다운 포커스
  const [inputValue, setInputValue] = useState("");
  const [isCommandActive, setIsCommandActive] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null); 
  const [commandPos, setCommandPos] = useState({ top: 0, left: 0 }); // 드롭다운

  // 입력 감지시 자동저장
  const saveTimeout = useRef(null);

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

// 블록 타입 & 콘텐츠 업데이트 (서버 및 상태 동시 업데이트)
const updateTypeAndContent = async (bid, index, type, content="") => {
  await updateBlockType(bid, type);
  await updateBlockContent(bid, content);
  const updated = [ ...blocks ];
  updated[index] = { ...updated[index], type, content };
  setBlocks(updated);
};

// setBlocks 로컬 상태 업데이트 
const updateBlockLocally = useCallback((index, changes) => {
  setBlocks((prev) => {
    if (!Array.isArray(prev)) return prev;
    if (index < 0 || index >= prev.length) return prev;
    const next = [...prev];
    next[index] = { ...next[index], ...changes };
    return next;
  });
}, [setBlocks]);

// 리인덱싱 : 순서 재정렬
const calculateOrderIndex = async (index) => {
  const prevOrder = blocks[index]?.order_index ?? 1000;
  const nextOrder = blocks[index + 1]?.order_index ?? prevOrder + 1000;
  let newOrder = Number(((prevOrder + nextOrder) / 2).toFixed(6));

  if (nextOrder - prevOrder < 0.0001) {
    console.warn("⚠️ 간격 부족 → 리인덱싱 시도");
    await reindexBlocks();
    const refreshed= await fetchBlocks();
    setBlocks(refreshed);
    const refreshedPrev = refreshed[index]?.order_index ?? 1000;
    const refreshedNext = refreshed[index + 1]?.order_index ?? refreshedPrev + 1000;
    newOrder = Number(((refreshedPrev + refreshedNext) / 2).toFixed(6));
  }
  return newOrder;
};


// 리인덱싱 후 전체 Fetch처리
const safeAddBlock = async (type = "text", content = "", order_index, checked) => {
  const result = await addBlock(type, content, order_index, checked);
  if (result?.reloadedBlocks) {
    const block = result.reloadedBlocks.findIndex((b) => b.bid === result.bid) || null;
    return { block, reloadedBlocks: result.reloadedBlocks};
  }
  return { block: result ?? null, reloadedBlocks: null };
};

// 블록 추가후 처리
// 체크리스트 : 엔터시 새 항목 추가
const insertChecklistAfter = async (index) => {
  const newOrder = await calculateOrderIndex(index);
  const { block: newBlock, reloadedBlocks } = await safeAddBlock("checklist", "", newOrder);
  if (!newBlock) return null;

  if (reloadedBlocks) {
    setBlocks(reloadedBlocks);
  } else {
    setBlocks(prev => {
      const before = prev.slice(0, index + 1);
      const after  = prev.slice(index + 1);
      return [...before, newBlock, ...after];
    });
  }
  requestAnimationFrame(() => {
    const nextEl = editorRefs.current[newBlock.bid];
    if (nextEl) {
      nextEl.dataset.lastEmptyEnter = "1";
      focusAndPlaceCaretEnd(nextEl);
    }
  });
  return newBlock;
};

// 텍스트 블록 추가 : 더블엔터 시 처리 : 토글, 인용, 콜아웃 등
const insertTextBlockAfter = async(index) => {
  const newOrder = await calculateOrderIndex(index);
  const { block: newBlock, reloadedBlocks } = await safeAddBlock("text", "", newOrder);
  if (!newBlock) return null;
  
  if (reloadedBlocks) {
    setBlocks(reloadedBlocks);
  } else {
    setBlocks(prev => {
      const before = prev.slice(0, index + 1);
      const after  = prev.slice(index + 1);
      return [...before, newBlock, ...after];
    });
  }
  // 새 블록으로 포커스 이동
  requestAnimationFrame(() => {
    const nextEl = editorRefs.current[newBlock.bid];
    nextEl && focusAndPlaceCaretEnd(nextEl);
  });
  return;
}; 

// 콜아웃 외곽 클릭 시 포커스
const handleCalloutContainerClick = (e, index) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  // 아이콘/색상 메뉴/스와치 등을 클릭한 경우에는 포커스 강제 이동 금지
  if (
    target.closest(".callout-icon") ||
    target.closest(".callout-menu-trigger") ||
    target.closest(".co-swatch") ||
    target.closest(".co-icon-btn")
  ) {
    return;
  }

  e.preventDefault();

  const bid = blocks[index]?.bid;
  const el = editorRefs.current[bid];
  if (el) {
    // 커서를 끝으로 보내서 바로 타이핑 가능하게
    focusAndPlaceCaretEnd(el);
  }
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
const debounceUpdateContent = (index, value, delay = 2000) => {
  if (saveTimeout.current) clearTimeout(saveTimeout.current);
  saveTimeout.current = setTimeout(() => {
    const bid = blocks[index]?.bid;
    if (bid) updateBlockContent(bid, value).catch(console.error);
  }, delay);
};

/* ==========================================
*            포커스/캐럿 유틸 + 네비게이션
========================================== */
// 커서가 contentEditable 내부에서 몇 글자인지 계산
const getCaretTextOffset = (rootEl) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;

  const range = sel.getRangeAt(0);
  if (!rootEl.contains(range.startContainer)) return 0;

  // text 시작부터 커서까지 길이 구하기
  const preRange = document.createRange();
  preRange.selectNodeContents(rootEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  
  const beforeText = preRange.toString();
  return beforeText.length;
}

// 시작/끝 여부 판정
const getCaretOffsets = (rootEl) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !rootEl.contains(sel.anchorNode)) {
    return { atStart: false, atEnd: false, length: rootEl?.innerText?.length ?? 0 };
  }
  const range = sel.getRangeAt(0);

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
const focusAndPlaceCaretEnd = (el) => {
  if (!el || !document.body.contains(el)) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

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

const isEditableBlock = (b) => b && b.type !== "divider";

const findPrevEditableIndex = (from) => {
  for (let i = from - 1; i >= 0; i--) 
    if (isEditableBlock(blocks[i])) 
      return i;
  return null;
};

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
      setBlocks(reloadedBlocks);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
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

  // 체크박스 직접 클릭이면 여기선 아무것도 하지 않음(토글만 되게)
  if (target.tagName === "INPUT") return;

  e.preventDefault();
  const bid = blocks[index]?.bid;
  const el = editorRefs.current[bid];
  if (el) {
    // 커서도 끝으로 보내주면 바로 타이핑 가능
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

//콜아웃
//색 
const setCalloutColor = useCallback(async (index, mode, color) => {
  // 서버 업데이트
  const target = blocks?.[index];
  const bid = target?.bid;
  if (!bid || target.type !== "callout") return;
  await updateCallout(bid, { mode, color });
  // 로컬 반영 (함수형)
  setBlocks(prev => {
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
}, [setBlocks, blocks]);
 
 //아이콘 
const setCalloutIcon = useCallback(async (index, iconId) => {
  const target = blocks?.[index];
  if (!target || target.type !== "callout") return;
  if (!Number.isInteger(iconId) || iconId < 0 || iconId > 9) return;
  await updateCallout(target.bid, { iconId });
  setBlocks(prev => {
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
}, [setBlocks, blocks]);



// 콜아웃 저장 디바운스
const debounceSaveCallout = useCallback((bid, value, delay = 500) => {
  if (saveTimerRef.current[bid]) clearTimeout(saveTimerRef.current[bid]);
  saveTimerRef.current[bid] = setTimeout(async () => {
    try {
      await updateBlockContent(bid, value);
      // 함수형 setBlocks로 bid 매칭 후 업데이트
      setBlocks(prev => {
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
}, [setBlocks]);


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

// blocks에 변화가 생길 때마다 문단의 끝 보정작업
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
      setBlocks(reloadedBlocks);
    } else {
      const updated = [
        ...blocks.slice(0, index + 1),
        { ...newBlock, content: after },
        ...blocks.slice(index + 1),
      ];
      setBlocks(updated);
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
    setBlocks(reloadedBlocks);
  } else {
    const updated = [
      ...blocks.slice(0, index + 1),
      { ...newBlock, content, checked },
      ...blocks.slice(index + 1),
    ];
    setBlocks(updated);
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

  // 필요하면 구독자에게 알림
  window.dispatchEvent(new CustomEvent("blocks:changed", {
    detail: { reason: "duplicate", srcBid: src.bid, newBid: newBlock.bid }
  }));
};



/* ******************************************************** */


/*
*  드롭다운 명령어 포커스
*/
const handleFocus = (e, index) => {
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

  const targetBlock = blocks.length > 0 ? blocks[index] : { content: "" };
  if (targetBlock && targetBlock.content === "당신의 일정을 채워보세요.") {
    e.currentTarget.innerText = "";
    const updated = [...blocks];

    if (updated[index]) {
      updated[index].content = "";
      setBlocks(updated);
    }
  }

};


/*
 * 명령어 입력 감지, 블록 컨텐트 업데이트 
 */
const handleInputChange = (e, index) => {
  const value = e.target.innerText;
  setInputValue(value);
  
  const block = blocks[index];
  const type = e.currentTarget.dataset.type || "text";

  // 2) 명령어 감지
  if (type === "text" && value.startsWith("/")) {
    setIsCommandActive(true); 
    setFocusedIndex(index);
    setFilteredCommands( blockCommands.filter((cmd) => cmd.label.startsWith(value)) );
    updateCommandPosition();
  } else {
    setIsCommandActive(false); // 명령어 드롭다운 닫기
    setFilteredCommands([]);
  }

  // 2) 콜아웃: 드래프트 관리, setBlocks는 디바운스 저장 시점에만
  if (type === "callout") {
    const bid = block.bid;
    draftRef.current[bid] = value;
    debounceSaveCallout(bid, value);
    return; 
  }
  // 3) 그외 프론트 상태 업데이트 (화면에 실시간 반영)
  updateBlockLocally(index, { content: value });
  // 2초 후 자동 저장 (디바운스 방식)
  debounceUpdateContent(index, value);
};

/* 
 *  포커스 아웃시 DB 업데이트
 */
const handleBlur = async (index, content, lid = null) => {
  const block = blocks[index];
  if (!block) return;
  const bid = block.bid;
  const filtered = (content === "/" || content === "\u200B") ? "" : content;

  // 콜아웃: 확정 저장 및 드래프트제거
  if (block.type === "callout") {
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
  if (block.content !== filtered) {
    try {
      await updateBlockContent(block.bid, filtered);
      console.log("✅ 블록 콘텐츠 업데이트 완료:", block.bid);
    } catch (err) {
      console.error("❌ 블럭 업데이트 실패:", err);
    }
  }
};

 // 체크리스트 체크/해제
  const handleChecklistToggle = async (index, checked) => {
    const block = blocks[index];
    if (!block || block.type !== "checklist") return;

    // UI 즉시 반영
    updateBlockLocally(index, { checked: !!checked });
    try {
      await toggleBlockChecked(block.bid, !!checked);
    } catch (e) {
      console.error("체크 토글 실패", e);
      // 실패 시 롤백
      updateBlockLocally(index, { checked: !checked });
    }
  };


/* 
 *  키타입 감지
 */
// 키 처리
  const handleKeyDown = async (e, index) => {
    const block = blocks[index];
    if (!block) return;

    const bid = block.bid;
    const type = block.type;
    const el = e.currentTarget;
    const fullText = el.innerText || "";

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
          await handleCommandSelect(cmd, index);
          return;
        }
      }
    }

    // 2) 드롭다운 비활성: ↑/↓로 블록 네비게이션 (divider 스킵)
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const { atStart, atEnd, length } = getCaretOffsets(el);

      if (e.key === "ArrowUp" && (atStart || length === 0)) {
        const prevIdx = findPrevEditableIndex(index);
        if (prevIdx !== null) {
          e.preventDefault();
          focusBlockEnd(blocks[prevIdx].bid);
          return;
        }
      }
      if (e.key === "ArrowDown" && (atEnd || length === 0)) {
        const nextIdx = findNextEditableIndex(index);
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
    const isEmpty = fullText.trim() === "";

    // 앞 블록과 병합
    if (e.key === "Backspace") {

      // 1) 콜아웃
      if (type === "callout") {
        if (isEmpty) {
          e.preventDefault();
          await handleBackspace(e, index);
          return;
        }
      }

      // 2) 구분선: 맨 앞을 포커싱하고 있고 윗 블록이 구분선 블록일 떄 
      if (cursorPos === 0 && index > 0 && blocks[index - 1]?.type === "divider") {
        e.preventDefault();
        const dividerBid = blocks[index - 1].bid;
        try {
          await deleteBlock(dividerBid);
          setBlocks((prev) => prev.filter((b) => b.bid !== dividerBid));
        } catch (err) {
          console.error("[divider 삭제 실패] ", err);
        }
        // await mergeWithPreviousBlock(index);
        return;
      }

      //3) 앞블록과 병합
      if (cursorPos === 0 && fullText.trim() !== "" && index > 0) {
        e.preventDefault();
        await mergeWithPreviousBlock(index);
        return;
      }
      // 4) 빈 블록 삭제
      if (fullText.trim() === "") {
        handleBackspace(e, index);
        return;
      }
    }

    // 4) Enter
    if (e.key === "Enter") {
      const fullText = el.innerText || "";
      const plain = fullText.replace(/\n/g, "").trim(); // 텍스트 기준으로 비어있는 줄
      const isEmptyText = el.dataset.lastEmptyEnter === "1";

      // 1) 콜아웃
      if(["callout"].includes(type)) {
        if (isEmptyText && plain === "") {
          e.preventDefault();
          el.dataset.lastEmptyEnter = "0";
          await insertTextBlockAfter(index);
          return;
        }
      // 현재 내용이 비어 있으면 "첫 빈 엔터"로 마킹, 아니면 플래그 리셋
      el.dataset.lastEmptyEnter = plain === "" ? "1" : "0";
      // 싱글 엔터: 콜아웃 내부 줄바꿈만
      e.preventDefault();
      return;
      }

      // 2) 토글 
      if (["toggle", "quote"].includes(type)) {
        if (isEmptyText && plain === "") {
          // 더블엔터: 종료
          e.preventDefault();
          el.dataset.lastEmptyEnter = "0";
          await insertTextBlockAfter(index);
          return;
        } 
        el.dataset.lastEmptyEnter = plain === "" ? "1" : "0";
        // 싱글 엔터: 같은 블록 내부 줄바꿈
        e.preventDefault();
        return;
      }

      // 3) 체크리스트
      if (type === "checklist") {
        e.preventDefault();
        
        const text = fullText.trim();

        // 1) 내용 있는 상태에서 Enter : 새로운 항목 추가
        if ( plain !== "") {
          try {
            await updateBlockContent(bid, text);
            updateBlockLocally(index, { content: text });
          } catch (err) {
            console.error("[front] checklist 저장실패: ", err);
          }
          // 더블엔터 리셋
          el.dataset.lastEmptyEnter = "0";
          await insertChecklistAfter(index);
          return;
        }

        // 2) 빈 줄에서  Enter
        if (isEmptyText) {
          el.dataset.lastEmptyEnter = "0";
          await updateTypeAndContent(bid, index, "text", "");
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
        e.preventDefault();
        await insertTextBlockAfter(index);
        return;
      }
      // ======================================================
      // 5) 나머지 일반 텍스트 블록: 커서 기준으로 블록 split
      // ======================================================
      e.preventDefault();
      await splitBlockAtCursor(index);
    }
  };



// 기존 블럭 수정 (명령어 선택 시 블록 타입 변경 + 서버 반영)
//switch
const handleCommandSelect = async (cmd, index) => {
  console.log("[handleCommandSelect] 1 진입. 명령어: ", cmd, "index:", index);

  const block = blocks[index];
  const bid = block.bid;
  // const el = editorRefs.current[bid];
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
  if (blocks.length === 1) {
    await updateTypeAndContent(bid, index, "text", "");
    // 마지막 하나 남으면 초기화만
    setBlocks([{ ...block, type: "text", content: "" }]);
    return;
  }
  // 그 외는 그냥 삭제
  await deleteBlock(bid);
  const updated = blocks.filter((_, i) => i !== index);
  setBlocks(updated);
    requestAnimationFrame(() => {
      const prev = document.querySelector(
        `.block:nth-child(${index}) .editable`
      );
      if (prev) {
          focusAndPlaceCaretEnd(prev)
      }
    });
  };

  // 병합 : 현재 블록을 바로 앞의 블록과 합침 (두 블록을 하나로 합쳐 업데이트)
  const mergeWithPreviousBlock = async (currentIndex) => {
    if (currentIndex === 0) return;

    const current = blocks[currentIndex];
    const previous = blocks[currentIndex - 1];
    const mergedContent = `${previous.content}${current.content}`;

    // [1] 서버에 병합된 내용 업데이트
    await updateBlockContent(previous.bid, mergedContent);
    await deleteBlock(current.bid);

    // [2] 로컬 상태 업데이트
    const updated = blocks.map((b, i) => {
      if (i === currentIndex - 1) return { ...b, content: mergedContent };
      if (i === currentIndex) return null;
      return b;
    }).filter(Boolean);
    setBlocks(updated);

    // [3] 화면에 즉시 병합된 내용 반영
    requestAnimationFrame(() => {
      const targetEl = editorRefs.current[currentIndex - 1];
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
        setBlocks(reloadedBlocks);
      } else {
        setBlocks((prev) => {
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
    // isEditableBlock, findPrevEditableIndex, findNextEditableIndex,
    // handlers
    handleInputChange,
    handleBlur,
    handleKeyDown,
    handleCommandSelect,
    handleDividerInsert,
    handleChecklistToggle,
    handleChecklistContainerClick,
    handleDuplicateBlock,
    // utils
    executeCommand: addBlock,
    getBlockClass,
    // getCaretOffsets,
    hoveredIndex, handleMouseEnter, handleMouseLeave,
    handleFocus,
    focusedIndex, setFocusedIndex,
    // focusBlockStart, focusBlockEnd,
    editorRefs,
    pendingFocusBidRef,
    focusAndPlaceCaretEnd,
    splitBlockAtCursor,
    // moveFocus,
    // updateCommandPosition,
    commandPos,
    handleCalloutContainerClick,
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
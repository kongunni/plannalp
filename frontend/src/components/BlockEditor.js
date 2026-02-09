import React, { useEffect, useMemo, useState, useRef } from "react";
import "../styles/global.css";
// 드래그앤드롭
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
// import
import useBlockEditor from "./useBlockEditor";
import { createCalloutBlock } from "../components/Callout"; 
import { usePageContext } from "../components/PageContext";
import { updateBlockOrder } from "../services/PageService";
// import { CSS } from "@dnd-kit/utilities";

const SortableBlock = React.memo(function SortableBlock({
  block,
  index,
  nextBlock,
  nextIndex,
  hoveredIndex,
  handleMouseEnter,
  handleMouseLeave,
  getBlockClass,
  editorRefs,
  handleInputChange,
  handleFocus,
  handleBlur,
  handleKeyDown,
  isCommandActive,
  filteredCommands,
  selectedCommandIndex,
  setFocusedIndex,
  handleCommandSelect,
  handleChecklistToggle,
  focusedIndex,
  handleDividerInsert,
  handleDuplicateBlock,
  setCalloutColor,
  setCalloutIcon,
  handleCalloutContainerClick,
  composingRef,
  isToggleCollapsedNow,
  setToggleCollapsedByBid,
  insertToggleChildText,
  safeParseMeta,
}) {

  

  const focusEnd = (el) => {
    if (!el || !document.body.contains(el)) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  };
  
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition, 
    isDragging, 
    setActivatorNodeRef 
  } = useSortable({
    id: block.bid,
  });

  const { bid, type, content, meta, depth } = block || {};
  const metaObj = typeof block?.meta === "string" ? safeParseMeta(block.meta) : (block?.meta || {});
  // 토글 자식 메타
  // const role = meta?.role; 
  const role = metaObj?.role || "";
  const isToggleChild = role === "toggle-content";
  // 콜아웃 메타
  const mode   = meta?.callout?.mode;
  const color  = meta?.callout?.color;
  const iconId = meta?.callout?.iconId;

  // 콜아웃 전용 루트
  const calloutRef = useRef(null);

  // 1) 콜아웃: wrapper/아이콘/색/모드 변경시에만 DOM 재생성
  useEffect(() => {
    if (type !== "callout") return;

    const host = calloutRef.current;
    if (!host) return;

    delete editorRefs.current[bid];
    host.innerHTML = "";

    const blockForDom = { bid, type, content, meta };
    // 새 DOM 생성
    const el = createCalloutBlock({
      block: blockForDom,
      index,
      handlers: {
        handleInputChange,
        handleKeyDown,
        handleBlur,
        handleFocus,
        editorRefs,
        setCalloutColor,
        setCalloutIcon,
        onCompositionStart: () => { composingRef.current = true; },
        onCompositionEnd:   () => { composingRef.current = false; },
      },
    });
    el.classList && el.classList.remove("block"); // .block 중첩 방지
    host.appendChild(el);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, mode, color, iconId]);

  // 2) 콜아웃 본문(text)만 content 변화에 따라 동기화
  useEffect(() => {
    if (type !== "callout") return;

    const host = calloutRef.current;
    if (!host) return;
    const editable = host.querySelector('.editable[data-type="callout"]');
    if (!editable) return;

    // 타이핑 중이면 동기화 안함 (caret 보호)
    if (document.activeElement === editable) return;

    const next = (content || "").toString();
    if (editable.innerText !== next) {
      editable.innerText = next;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, content]);
  // }, [content]);
  
  //드래그 css
  const style = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)`
    : undefined,
    transition,
    opacity: isDragging ? 0 : 1,
    willChange: 'transform',
    backfaceVisibility: 'hidden',
  };
  // 들여쓰기 css
    const toDepth = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const depthLevel  = toDepth(depth, 0);
  const indentStyle = { paddingLeft: `${depthLevel * 16}px` };

  // };

  return(
    <React.Fragment>
    <div
        className={`block ${isToggleChild ? "toggle-child" : ""}`}
        ref={setNodeRef}
        style={style}
        onMouseEnter={() => handleMouseEnter(index)}
        onMouseLeave={handleMouseLeave}
        data-bid={block.bid}
        data-role={role || ""} 
        {...attributes}
    >
      {/* 핸들/플러스 */}
      {hoveredIndex === index && (
        <div className="block-handle">
          <span className="drag-handle" 
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
          >
            ::
          </span>
          <span
                className="add-block"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDuplicateBlock(index);
                }}
          >+</span>
        </div>
      )}

      {/* divider */}
      {block.type === "divider" ? (
        <hr className="block-divider" data-type={block.type} tabIndex={-1} aria-hidden="true" />
      ) : block.type === "checklist" ? (
      // checklist
      <div className={`editable-wrapper ${getBlockClass(block.type)}`} data-type={block.type}>
        <div
            className="checklist-item"
            onClick={(e) => { 
              const target = e.target;
              if (!(target instanceof HTMLElement)) return;
              if (target.tagName === "INPUT" || target.closest('.editable')) return;
              const el = editorRefs.current[block.bid];
              if (el) { focusEnd(el); }
            }}
        >
          <input
                type="checkbox"
                checked={!!block.checked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleChecklistToggle(index, e.target.checked)}
          />
            <div
                className={`editable checklist-text ${getBlockClass(block.type)} ${block.checked ? "checked" : ""}`}
                contentEditable
                suppressContentEditableWarning
                data-type={block.type}
                data-bid={block.bid}
                ref={(el) => { if (el) editorRefs.current[block.bid] = el;  else delete editorRefs.current[block.bid]; }}
                onInput={(e) => handleInputChange(e, index)}
                onFocus={(e) => handleFocus(e, index)}
                onBlur={(e) => handleBlur(index, e.currentTarget.innerText)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
            />
        </div>
      </div>
      ) : block.type === "callout" ? (
      <div
          className={`editable-wrapper block-callout-wrapper`}
          data-type={block.type}
          onMouseDown={(e) => handleCalloutContainerClick(e, index)}
      >
          <div ref={calloutRef} />
        </div>
      ) : block.type === "toggle" ? (
       <div
            className={`editable-wrapper ${getBlockClass(block.type)} toggle-wrapper ${
              isToggleCollapsedNow ? "collapsed" : "expanded"
            }`}
            data-type="toggle"
            data-collapsed={isToggleCollapsedNow ? "1" : "0"}
            style={indentStyle}
          >
          <div className="toggle-header">
            <button
              className="toggle-caret"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // 토글 상태 변경: 접힌 상태면 펼치기
                const isExpanding = isToggleCollapsedNow;
                setToggleCollapsedByBid(block.bid);
                
                setTimeout(async () => {

                if (isExpanding) {
                  // 열리는 경우: 첫 자식이 있으면 포커스
                  const next = nextBlock;
                  const depth0 = Number.isFinite(Number(block.depth)) ? Number(block.depth) : 0;

                  const isChild =
                    next &&
                    Number(next.parent_bid) === Number(block.bid) &&
                    (Number.isFinite(Number(next.depth)) ? Number(next.depth) : -999) === depth0 + 1;

                  if (isChild) {
                    const childEl = editorRefs.current[next.bid];
                    if (childEl) { focusEnd(childEl); return; }
                  }

                  // 자식이 없으면 생성 후 포커스 (원하시는 UX라면)
                  const created = await insertToggleChildText(block.bid);
                  if (created?.bid) {
                    const childEl = editorRefs.current[created.bid];
                    if (childEl) focusEnd(childEl);
                  }
                  return;
                }
                // 닫히는 경우: 헤더 유지
                const headerEl = editorRefs.current[block.bid];
                if (headerEl) focusEnd(headerEl);
                }, 0);
              }}
            >
              {isToggleCollapsedNow ? "▶" : "▼"}
            </button>

            <div className="toggle-header-editor">
            {block.content === "" && focusedIndex === index && (
              <span className="blockPlaceholder">토글</span>
            )}
            <div
              className={`editable ${getBlockClass(block.type)}`}
              contentEditable
              suppressContentEditableWarning
              data-type="toggle"
              data-bid={block.bid}
              ref={(el) => {
                if (el) editorRefs.current[block.bid] = el;
                else delete editorRefs.current[block.bid];
              }}
              onInput={(e) => handleInputChange(e, index)}
              onFocus={(e) => handleFocus(e, index)}
              onBlur={(e) => handleBlur(index, e.currentTarget.innerText)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onCompositionStart={() => (composingRef.current = true)}
              onCompositionEnd={() => (composingRef.current = false)}
            />
            </div>
          </div>
        </div>
      ) : block.type === "quote" ? (
        <div
            className={`editable-wrapper ${getBlockClass("quote")}`}
            data-type="quote"
            style={indentStyle}
        >
          {block.content === "" && focusedIndex === index && (
            <span className="blockPlaceholder">인용</span>
          )}

          <div
            className={`editable block-quote`}
            contentEditable
            suppressContentEditableWarning
            data-type="quote"
            data-bid={block.bid}
            ref={(el) => {
              if (el) editorRefs.current[block.bid] = el;
              else delete editorRefs.current[block.bid];
            }}
            onInput={(e) => handleInputChange(e, index)}
            onFocus={(e) => handleFocus(e, index)}
            onBlur={(e) => handleBlur(index, e.currentTarget.innerText)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onCompositionStart={() => (composingRef.current = true)}
            onCompositionEnd={() => (composingRef.current = false)}
          />
        </div>
      ) : (
      // 일반 블록
      <div
      // className={`editable-wrapper ${getBlockClass(block.type)}`}
          className={`editable-wrapper ${getBlockClass(block.type)} ${isToggleChild ? "toggle-content" : ""}`}
          data-type={block.type}
          data-role={role || ""}
          onClick={(e) => {
            if (e.target.closest('.editable')) return;
            const el = editorRefs.current[block.bid];
            if (el) { focusEnd(el); }
          }}
      >
      {block.content === "" && focusedIndex === index && (<span className="blockPlaceholder">명령어 사용 시에는 '/'를 누르세요...</span>)}
        <div
            className={`editable ${getBlockClass(block.type)}`}
            contentEditable
            suppressContentEditableWarning
            data-type={block.type}
            data-bid={block.bid}
            ref={(el) => { if (el) editorRefs.current[block.bid] = el;  else delete editorRefs.current[block.bid];}}
            onInput={(e) => handleInputChange(e, index)}
            onFocus={(e) => handleFocus(e, index)}
            onBlur={(e) => handleBlur(index, e.currentTarget.innerText)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
          />
        </div>
      )}
    </div>
    </React.Fragment>
  );
}); // sortableBlock end


const BlockEditor = () => {
  console.log("1. [blockEditor rendering ] ...  ");

  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    console.log("2. [BlockEditor] mounted");
    
    const cnt = document.querySelectorAll(".block-container").length;
    console.log("3. [conunt]", cnt);
    
    return () => console.log("4. [BlockEditor] unmounted");
  },[]);


  const { blocks, setBlocks } = usePageContext();
  const displayedBlocks = useMemo(() => (Array.isArray(blocks) ? blocks : []), [blocks]);

  // import useBlockEditor
  const {
    // state
    isCommandActive, 
    filteredCommands, 
    selectedCommandIndex, 
    focusedIndex, setFocusedIndex,
    hoveredIndex,
    focusAndPlaceCaretEnd,
    pendingFocusBidRef,
    // handlers
    handleInputChange, handleBlur, handleKeyDown, handleCommandSelect,
    handleChecklistToggle, handleDividerInsert,
    handleMouseEnter, handleMouseLeave, handleFocus,
    handleDuplicateBlock,
    handleCalloutContainerClick,
    isToggleCollapsed, setToggleCollapsedByBid, insertToggleChildText,
    // utils
    getBlockClass, editorRefs, 
    commandPos,
    setCalloutColor, setCalloutIcon,
    composingRef,

  } = useBlockEditor(blocks, setBlocks);

// 접힌 토글의 자식 숨기기용 visibleBlocks
const visibleBlocks = useMemo(() => {
  const result = [];
  let hiddenDepth = null;

  for (let i = 0; i < displayedBlocks.length; i++) {
    const block = displayedBlocks[i];
    const depth = Number.isFinite(Number(block.depth)) ? Number(block.depth) : 0;

    // 이미 접힌 토글 아래면 숨김
    if (hiddenDepth !== null) {
      if (depth > hiddenDepth) continue;
      hiddenDepth = null;
    }

    const isToggleCollapsedNow = block.type === "toggle" && isToggleCollapsed(block);

    // sortableBlock에 전달할 데이터
    result.push({ block, displayedIndex: i, isToggleCollapsedNow });

    // 접힌 토글이면 이후 자식 숨김
    if (isToggleCollapsedNow) {
      hiddenDepth = depth;
    }

    console.log(
      "[visibleBlocks]",
      "bid:", block.bid,
      "type:", block.type,
      "depth:", depth,
      "collapsed:", block.type === "toggle" ? isToggleCollapsed(block) : null,
      "hiddenDepth:", hiddenDepth
    );

  }
  return result;

  

}, [displayedBlocks, isToggleCollapsed]);


  useEffect(() => {
    const ids = displayedBlocks.map(b => b.bid);
    console.log("[BlockEditor] blocks len:", displayedBlocks.length, ids);
    // 중복 체크
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) console.warn("[BlockEditor] DUP BIDs:", dup);
  }, [displayedBlocks]);

  // ────────────────────────────────────────────────────────────
  // Hydration: 상태 → contentEditable (활성 엘리먼트는 건드리지 않음)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const list = Array.isArray(displayedBlocks) ? displayedBlocks : [];
    list.forEach((b) => {
      if (b.type === "callout") return;

      const el = editorRefs.current[b.bid];

      if (!el || !document.body.contains(el)) {
        delete editorRefs.current[b.bid];
        return;
      }

      if (document.activeElement === el) return;

      const next = (b.content ?? "").toString();
      if (el.innerText !== next) el.innerText = next;
    });
  }, [displayedBlocks, editorRefs]);


// ────────────────────────────────────────────────────────────
// 새 블록이 렌더링 되면 예약된 bid로 포커스를 1회 이동
// ────────────────────────────────────────────────────────────
useEffect(() => {
  const bid = pendingFocusBidRef.current;
  if (!bid) return;

  let tries = 0;

  const tryFocus = () => {
    tries += 1;

    const el =
      editorRefs.current[bid] ||
      document.querySelector(`.editable[data-bid="${bid}"]`);

    if (el) {
      focusAndPlaceCaretEnd(el);
      pendingFocusBidRef.current = null;
      return;
    }

    if (tries < 4) requestAnimationFrame(tryFocus);
  };

  requestAnimationFrame(tryFocus);
}, [displayedBlocks, focusAndPlaceCaretEnd, editorRefs]);

  // ────────────────────────────────────────────────────────────
  // Drag & Drop
  // ────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [overId, setOverId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // "before" | "after" | null

  const idToIndex = useMemo(() => {
    const map = new Map();
    displayedBlocks.forEach((b, idx) => map.set(b.bid, idx));
    return map;
  }, [displayedBlocks]);


  const handleDragStart = (event) => {
    const id = event?.active?.id;
      if (id) setActiveId(id);
    };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) {
      setOverId(null);
      setDropPosition(null);
      return;
    }
    setOverId(over.id);

    const activeTop = active.rect.current.translated?.top ?? active.rect.current.initial.top;
    const overTop = over.rect.top;
    const overMidY = overTop + over.rect.height / 2;

    setDropPosition(activeTop < overMidY ? "before" : "after");
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);

    if (!over || active.id === over.id) return;
    const from = idToIndex.get(active.id);
    const overIdx = idToIndex.get(over.id);
    if (from == null || overIdx == null) return;

    const to = dropPosition === "before" ? overIdx : overIdx + 1;
    const boundedTo = Math.max(0, Math.min(displayedBlocks.length - 1, to));

    const newList = arrayMove(displayedBlocks, from, boundedTo);
    setBlocks(newList);

    const moved = newList[boundedTo];
    const prev = newList[boundedTo - 1] ?? null;
    const next = newList[boundedTo + 1] ?? null;
    const prevOrder = prev ? prev.order_index : 0;
    const nextOrder = next ? next.order_index : prevOrder + 2000;

    try {
      const res = await updateBlockOrder(moved.bid, prevOrder, nextOrder);
      if (res?.reloadedBlocks) setBlocks(res.reloadedBlocks);
    } catch (err) {
      console.error("서버 반영 실패, 롤백", err);
      const rolledBack = arrayMove(newList, boundedTo, from);
      setBlocks(rolledBack);
    }
  };


// render 
return (
    <div className="block-container">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
      >
        {/*  SortableContext: visibleBlocks 기준 */}
        <SortableContext
          items={visibleBlocks.map(({ block }) => block.bid)}
          strategy={verticalListSortingStrategy}
        >
          {visibleBlocks.map(({ block, displayedIndex, isToggleCollapsedNow }) => {
            const nextBlock = displayedBlocks[displayedIndex + 1] ?? null;
            const nextIndex = displayedIndex + 1;

            return (
              <React.Fragment key={block.bid}>
                {/* before 인디케이터 */}
                {overId === block.bid && dropPosition === "before" && (
                  <div className="drop-indicator" />
                )}

                <SortableBlock
                  block={block}
                  index={displayedIndex} // displayedBlocks기준 index
                  nextBlock={nextBlock}  
                  nextIndex={nextIndex}  
                  hoveredIndex={hoveredIndex}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  getBlockClass={getBlockClass}
                  editorRefs={editorRefs}
                  handleInputChange={handleInputChange}
                  handleFocus={handleFocus}
                  handleBlur={handleBlur}
                  handleKeyDown={handleKeyDown}
                  isCommandActive={isCommandActive}
                  filteredCommands={filteredCommands}
                  selectedCommandIndex={selectedCommandIndex}
                  setFocusedIndex={setFocusedIndex}
                  handleCommandSelect={handleCommandSelect}
                  handleChecklistToggle={handleChecklistToggle}
                  focusedIndex={focusedIndex}
                  handleDividerInsert={handleDividerInsert}
                  handleDuplicateBlock={handleDuplicateBlock}
                  setCalloutColor={setCalloutColor}
                  setCalloutIcon={setCalloutIcon}
                  handleCalloutContainerClick={handleCalloutContainerClick}
                  composingRef={composingRef}
                  isToggleCollapsedNow={isToggleCollapsedNow}
                  setToggleCollapsedByBid={setToggleCollapsedByBid}
                  insertToggleChildText={insertToggleChildText}
                />

                {/* after 인디케이터 */}
                {overId === block.bid && dropPosition === "after" && (
                  <div className="drop-indicator" />
                )}

                {/* 명령어 드롭다운 */}
                {isCommandActive && displayedIndex === focusedIndex && (
                  <div
                    className="commandDropdown"
                    style={{
                      position: "fixed",
                      top: commandPos.top,
                      left: commandPos.left,
                      zIndex: 1000,
                    }}
                  >
                    {filteredCommands.map((cmd, i) => (
                      <div
                        key={cmd.type}
                        className={`commandItem ${
                          selectedCommandIndex === i ? "selected" : ""
                        }`}
                        onClick={() => handleCommandSelect(cmd, focusedIndex)}
                        onMouseDown={() => setFocusedIndex(displayedIndex)}
                      >
                        {cmd.label}
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </SortableContext>

        <DragOverlay>
          {activeId ? <div className="drag-overlay-ghost" /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BlockEditor;













// ================================================







// import React, { useEffect, useMemo, useState } from "react";
// import "../styles/global.css";
// import { updateBlockOrder } from "../services/PageService";
// import { usePageContext } from "../components/PageContext";
// import useBlockEditor from "./useBlockEditor";

// import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
// import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
// import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
// // import { CSS } from "@dnd-kit/utilities";

// const BlockEditor = () => {
// // const BlockEditor = ({ blocks = [], setBlocks }) => {
//   const { blocks, setBlocks } = usePageContext();
//   const displayedBlocks = useMemo(
//     () => (Array.isArray(blocks) ? blocks : []),
//     [blocks]
//   );
  
//   // const [isLoaded, setIsLoaded] = useState(false);
//   // const displayedBlocks = useMemo(() => {
//   //   const safe = Array.isArray(blocks) ? blocks : [];
//   //   return isLoaded ? safe : [];
//   // }, [isLoaded, blocks]);

//   const {
//     // state
//     isCommandActive, 
//     filteredCommands, 
//     selectedCommandIndex, 
//     focusedIndex, setFocusedIndex,
//     hoveredIndex,
//     // setIsCommandActive,
//     // setFilteredCommands,
//     // setSelectedCommandIndex,

//     // handlers
//     handleInputChange, handleBlur, handleKeyDown, handleCommandSelect,
//     handleChecklistToggle, handleDividerInsert,
//     handleMouseEnter, handleMouseLeave, handleFocus,
//     handleChecklistContainerClick,

//     // utils
//     getBlockClass, editorRefs, 
//     pendingFocusBidRef, // 포커스 복원용
//     commandPos, 
//     // moveFocus,
//     // updateCommandPosition,
//   } = useBlockEditor(blocks, setBlocks);

//   // // 초기로딩 : blocks가 갱신되면 대기 중인 포커스 대상에 커서 이동
//   // useEffect(() => {
//   //   const bid = pendingFocusBidRef.current;
//   //   if (!bid) return;

//   //   requestAnimationFrame(() => {
//   //     const el = editorRefs.current[bid];
//   //     if (!el) return;
//   //     el.focus();
//   //     const range = document.createRange();
//   //     range.selectNodeContents(el);
//   //     range.collapse(false);
//   //     const sel = window.getSelection();
//   //     sel.removeAllRanges();
//   //     sel.addRange(range);
//   //     pendingFocusBidRef.current = null; // 한번 쓰고 초기화
//   //   });
//   // }, [blocks, editorRefs, pendingFocusBidRef]);


//   // ---- 드래그 관련 ----
//   const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
//   // const [activeId, setActiveId] = useState(null);
//   const [overId, setOverId] = useState(null);
//   const [dropPosition, setDropPosition] = useState(null); // "before" | "after" | null

//   const idToIndex = useMemo(() => {
//     const map = new Map();
//     displayedBlocks.forEach((b, idx) => map.set(b.bid, idx));
//     return map;
//   }, [displayedBlocks]);


//   const handleDragStart = (event) => {};

//   const handleDragOver = (event) => {
//     const { active, over } = event;
//     if (!over) {
//       setOverId(null);
//       setDropPosition(null);
//       return;
//     }
//     setOverId(over.id);

//     const activeTop = active.rect.current.translated?.top ?? active.rect.current.initial.top;
//     const overTop = over.rect.top;
//     const overMidY = overTop + over.rect.height / 2;

//     setDropPosition(activeTop < overMidY ? "before" : "after");
//   };

//   const handleDragEnd = async (event) => {
//     const { active, over } = event;
//     setOverId(null);
//     setDropPosition(null);

//     if (!over || active.id === over.id) return;
//     const from = idToIndex.get(active.id);
//     const overIdx = idToIndex.get(over.id);
//     if (from == null || overIdx == null) return;

//     const to = dropPosition === "before" ? overIdx : overIdx + 1;
//     const boundedTo = Math.max(0, Math.min(displayedBlocks.length - 1, to));

//     const newList = arrayMove(displayedBlocks, from, boundedTo);
//     setBlocks(newList);

//     const moved = newList[boundedTo];
//     const prev = newList[boundedTo - 1] ?? null;
//     const next = newList[boundedTo + 1] ?? null;
//     const prevOrder = prev ? prev.order_index : 0;
//     const nextOrder = next ? next.order_index : prevOrder + 2000;

//     try {
//       const res = await updateBlockOrder(moved.bid, prevOrder, nextOrder);
//       if (res?.reloadedBlocks) setBlocks(res.reloadedBlocks);
//     } catch (err) {
//       console.error("서버 반영 실패, 롤백", err);
//       const rolledBack = arrayMove(newList, boundedTo, from);
//       setBlocks(rolledBack);
//     }
//   };

//   // ---- 초기 로딩 ----
//   // useEffect(() => {
//   //   (async () => {
//   //     const existing = await fetchBlocks();
//   //     if (existing.length === 0) {
//   //       const nb = await addBlock("text", "");
//   //       if (nb) setBlocks([nb]);
//   //     } else {
//   //       setBlocks(existing);
//   //     }
//   //     setIsLoaded(true);
//   //   })();
//   // }, [setBlocks]);
//    useEffect(() => {
//     const bid = pendingFocusBidRef?.current;
//     if (!bid) return;
//     requestAnimationFrame(() => {
//       const el = editorRefs.current[bid];
//       if (!el) return;
//       el.focus();
//       const r = document.createRange();
//       r.selectNodeContents(el);
//       r.collapse(false);
//       const sel = window.getSelection();
//       sel.removeAllRanges();
//       sel.addRange(r);
//       pendingFocusBidRef.current = null;
//     });
//   }, [blocks, editorRefs, pendingFocusBidRef]);

//   // useEffect(() => {
//   //   blocks.forEach((block, i) => {
//   //     const el = document.querySelector(`.block:nth-child(${i + 1}) .editable`);
//   //     if (el && block.content && el.innerText.trim() === "") el.innerText = block.content;
//   //   });
//   // }, [blocks]);

//   return (
//     <div className="block-container">
//       <DndContext
//         sensors={sensors}
//         onDragStart={handleDragStart}
//         onDragOver={handleDragOver}
//         onDragEnd={handleDragEnd}
//         modifiers={[restrictToVerticalAxis]}
//       >
//         <SortableContext items={displayedBlocks.map((b) => b.bid)} strategy={verticalListSortingStrategy}>
//           {displayedBlocks.map((block, index) => (
//             <React.Fragment key={block.bid}>
//               {/* === 드롭 인디케이터 (노션식 파란 밑줄) === */}
//               {overId === block.bid && dropPosition === "before" && <div className="drop-indicator" />}
              
//               <div
//                 className="block"
//                 onMouseEnter={() => handleMouseEnter(index)}
//                 onMouseLeave={handleMouseLeave}
//                 data-bid={block.bid}
//               >
//                 {hoveredIndex === index && (
//                   <div className="block-handle">
//                     <span className="drag-handle">::</span>
//                     <span
//                       className="add-block"
//                       onMouseDown={(e) => {
//                         e.preventDefault();
//                         handleDividerInsert(index);
//                       }}
//                     >
//                       +
//                     </span>
//                   </div>
//                 )}

//                 {/* --- divider --- */}
//                 {block.type === "divider" ? (
//                   <div
//                     className="editable block-divider"
//                     data-type={block.type}
//                     contentEditable
//                     suppressContentEditableWarning
//                     tabIndex={0}
//                     onKeyDown={(e) => handleKeyDown(e, index)}
//                   />
//                 ) : block.type === "checklist" ? (
//                   <div className={`editable-wrapper ${getBlockClass(block.type)}`} data-type={block.type}>
//                     <div 
//                          className="checklist-item"
//                          onClick={(e) => {handleChecklistContainerClick(e, index)}}
//                     >
//                       <input
//                         type="checkbox"
//                         checked={!!block.checked}
//                         onClick={(e) => e.stopPropagation()}
//                         onChange={(e) => handleChecklistToggle(index, e.target.checked)}
//                       />
//                       <div
//                         className={`editable checklist-text ${getBlockClass(block.type)} ${block.checked ? "checked" : ""}`}
//                         contentEditable
//                         suppressContentEditableWarning
//                         ref={(el) => { if (el) editorRefs.current[block.bid] = el; }}
//                         data-type={block.type}
//                         data-bid={block.bid}
//                         onMouseDown={(e) => e.preventDefault()}
//                         onInput={(e) => handleInputChange(e, index)}
//                         onFocus={(e) => handleFocus(e, index)}
//                         onBlur={(e) => handleBlur(index, e.currentTarget.innerText.trim())}
//                         onKeyDown={(e) => handleKeyDown(e, index)}
//                       />
//                     </div>
//                   </div>
//                 ) : (
//                   <div
//                     className={`editable-wrapper ${getBlockClass(block.type)}`}
//                     data-type={block.type}
//                     onClick={() => editorRefs.current[block.bid]?.focus()}
//                   >
//                     {block.content === "" && focusedIndex === index && (
//                       <span className="blockPlaceholder">명령어 사용 시에는 '/'를 누르세요...</span>
//                     )}
//                     <div
//                       className={`editable ${getBlockClass(block.type)}`}
//                       contentEditable
//                       suppressContentEditableWarning
//                       ref={(el) => { if (el) editorRefs.current[block.bid] = el; }}
//                       onInput={(e) => handleInputChange(e, index)}
//                       onFocus={(e) => handleFocus(e, index)}
//                       onBlur={(e) => handleBlur(index, e.currentTarget.innerText.trim())}
//                       onKeyDown={(e) => handleKeyDown(e, index)}
//                     />
//                   </div>
//                 )}
//               </div>

//               {/* === after 위치 인디케이터 === */}
//               {overId === block.bid && dropPosition === "after" && <div className="drop-indicator" />}

//               {/* 명령어 드롭다운 */}
//               {isCommandActive && index === focusedIndex && (
//                 <div 
//                     className="commandDropdown"
//                     style={{
//                       position: 'fixed',
//                       top: commandPos.top,
//                       left: commandPos.left,
//                       zIndex: 1000,
//                     }}
//                 >
//                   {filteredCommands.map((cmd, i) => (
//                     <div
//                       key={cmd.type}
//                       className={`commandItem ${selectedCommandIndex === i ? "selected" : ""}`}
//                       onClick={() => handleCommandSelect(cmd, focusedIndex)}
//                       onMouseDown={() => setFocusedIndex(index)}
//                     >
//                       {cmd.label}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </React.Fragment>
//           ))}
//         </SortableContext>
//       </DndContext>
//     </div>
//   );
// };

// export default BlockEditor;

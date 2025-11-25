/*
  onClick 처리 수정하기 
  - onClick 이벤트 포커스 수정해야됨 각자 ㅏㄷ 수정 ㄱㄱ 
*/ 
import React, { useEffect, useMemo, useState, useRef } from "react";
import "../styles/global.css";
// 드래그앤드롭
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
// import
import useBlockEditor from "./useBlockEditor";
import { createCalloutBlock } from "../components/Callout"; 
import { usePageContext } from "../components/PageContext";
import { updateBlockOrder } from "../services/PageService";
// import { CSS } from "@dnd-kit/utilities";



const SortableBlock = ({
  block,
  index,
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
  composingRef
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.bid,
  });

  const { bid, type, content, meta } = block || {};
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

    // 기존 DOM 제거
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

    // .block 중첩 방지
    el.classList && el.classList.remove("block");

    // DOM 삽입
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
    }, [content]);
    
  // 드래그 css
  const style = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)`
    : undefined,
    transition,
    opacity: isDragging ? 0.9 : 1,
    willChange: 'transform',
    backfaceVisibility: 'hidden',
  };

  return(
  <React.Fragment>
    <div
        className="block"
        ref={setNodeRef}
        style={style}
        onMouseEnter={() => handleMouseEnter(index)}
        onMouseLeave={handleMouseLeave}
        data-bid={block.bid}
        {...attributes}
    >
      {/* 핸들/플러스 */}
      {hoveredIndex === index && (
        <div className="block-handle">
          <span className="drag-handle" {...listeners}>::</span>
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
        <hr
            className="block-divider"
            data-type={block.type}
            tabIndex={-1}
            aria-hidden="true"
        />
      ) : block.type === "checklist" ? (
      // checklist
      <div className={`editable-wrapper ${getBlockClass(block.type)}`} data-type={block.type}>
        <div
            className="checklist-item"
            onClick={(e) => {
              const isInput = e.target instanceof HTMLElement && e.target.tagName === "INPUT";
              if (!isInput) {
                e.preventDefault();
                editorRefs.current[block.bid]?.focus();
              }
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
                ref={(el) => {
                  if (el) editorRefs.current[block.bid] = el;
                }}
                onInput={(e) => handleInputChange(e, index)}
                onFocus={(e) => handleFocus(e, index)}
                onBlur={(e) => handleBlur(index, e.currentTarget.innerText.trim())}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
            />
          </div>
        </div>
        ) : block.type === "callout" ? (
          <div
              className={`editable-wrapper ${getBlockClass(block.type)}`}
              data-type={block.type}
              onClick={(e) => handleCalloutContainerClick(e, index)}
          >
            <div ref={calloutRef} />
          </div>
        ): (
        // 일반 블록
        <div
            className={`editable-wrapper ${getBlockClass(block.type)}`}
            data-type={block.type}
            onClick={() => editorRefs.current[block.bid]?.focus()}
        >
        {block.content === "" && focusedIndex === index && (<span className="blockPlaceholder">명령어 사용 시에는 '/'를 누르세요...</span>)}
          <div
              className={`editable ${getBlockClass(block.type)}`}
              contentEditable
              suppressContentEditableWarning
              data-type={block.type}
              data-bid={block.bid}
              ref={(el) => {
                if (el) editorRefs.current[block.bid] = el;
              }}
              onInput={(e) => handleInputChange(e, index)}
              onFocus={(e) => handleFocus(e, index)}
              onBlur={(e) => handleBlur(index, e.currentTarget.innerText.trim())}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              />
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

const BlockEditor = () => {
  console.log("1. [blockEditor rendering ] ...  ");
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
    // handlers
    handleInputChange, handleBlur, handleKeyDown, handleCommandSelect,
    handleChecklistToggle, handleDividerInsert,
    handleMouseEnter, handleMouseLeave, handleFocus,
    handleDuplicateBlock,
    handleCalloutContainerClick,
    // utils
    getBlockClass, editorRefs, 
    commandPos,
    setCalloutColor, setCalloutIcon,
    composingRef
  } = useBlockEditor(blocks, setBlocks);

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
      if (!el) return;
      if (document.activeElement === el) return;

      const next = (b.content ?? "").toString();
      if (el.innerText !== next) el.innerText = next;
    });
  }, [displayedBlocks, editorRefs]);

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


  const handleDragStart = (event) => {};

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

 return (
    <div className="block-container">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={displayedBlocks.map((b) => b.bid)} strategy={verticalListSortingStrategy}>
          {displayedBlocks.map((block, index) => (
            <React.Fragment key={block.bid}>
              {/* 드롭 인디케이터 */}
              {overId === block.bid && dropPosition === "before" && <div className="drop-indicator" />}

              {/* SortableBlock */}
              <SortableBlock
                block={block}
                index={index}
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
              />
             
              {/* after 인디케이터 */}
              {overId === block.bid && dropPosition === "after" && <div className="drop-indicator" />}

              {/* 명령어 드롭다운 (캐럿 아래 고정) */}
              {isCommandActive && index === focusedIndex && (
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
                      className={`commandItem ${selectedCommandIndex === i ? "selected" : ""}`}
                      onClick={() => handleCommandSelect(cmd, focusedIndex)}
                      onMouseDown={() => setFocusedIndex(index)}
                    >
                      {cmd.label}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </SortableContext>
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

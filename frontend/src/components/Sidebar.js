import React, { useState, useEffect, useRef } from "react";
import { usePageContext } from "../components/PageContext";
import { addPage, renamePage, duplicatePage, moveToTrash, restorePage, deletePagePermanently, switchFavorite, updatePageOrder } from "../services/PageService"; 
import { useNavigate } from "react-router-dom";
import { AiOutlineFile, AiFillStar, AiOutlineStar, AiOutlineCopy, AiOutlineEdit, AiOutlineUndo,  AiOutlineDelete, AiOutlineLeft, AiOutlineMenu } from "react-icons/ai"; 
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
// import axios from "axios";

const Sidebar = () => {
    const navigate = useNavigate();
    const { pages, loadPages, trashList, loadTrashPages } = usePageContext();
    const uid = localStorage.getItem("uid");

    const [selectedPid, setSelectedPid] = useState(null);
    const [newPageTitle, setNewPageTitle] = useState("");
    const [editingPageId, setEditingPageId] = useState(null);
    const [hoveredPid, setHoveredPid] = useState(null);
    const [showPageSettings, setShowPageSettings] = useState(null);
    const [isAddingPage, setIsAddingPage] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [sortedPages, setSortedPages] = useState([]);


      // 휴지통
      const [showTrash, setShowTrash] = useState(false);
      const [modalActive, setModalActive] = useState(false);
      const trashButtonRef = useRef(null); 
      const modalRef = useRef(null);

    // ✅ 페이지 목록 최조 업로드
    useEffect(() => {
        if (!uid) return;
        loadPages();
    }, [uid, loadPages]);

    // ✅ 페이지 목록 정렬 (즐겨찾기 + 일반 페이지 분리)
    useEffect(() => {
        // 🔥 즐겨찾기된 페이지와 일반 페이지 분리
        const favoritePages = [];
        const normalPages = [];
    
        pages.forEach((page) => {
            if (page.is_favorite) {
                favoritePages.push(page);
            } else {
                normalPages.push(page);
            }
        });
    
        // 🔥 sort_order 기준 정렬 (복제 후 올바르게 위치하도록)
        favoritePages.sort((a, b) => a.sort_order - b.sort_order);
        normalPages.sort((a, b) => a.sort_order - b.sort_order);
    
        // 🔥 즐겨찾기 + 일반 페이지 순서 유지
        setSortedPages([...favoritePages, ...normalPages]);
    }, [pages]);

    // ... 사이드바 설정창
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showPageSettings !== null) {
                // 설정창 외부 클릭 시 닫기
                if (!event.target.closest(".pageSettings") && !event.target.closest(".settingsButton")) {
                    setShowPageSettings(null);
                }
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, [showPageSettings]);

    // ✅ 페이지 선택 시 이동
    const handleSelectedPage = (pid, title) => {
        setSelectedPid(pid);
        navigate(`/pages/${pid}`, { state: { title } });
    };

    // ✅ 새 페이지 추가
    const handleAddPage = async () => {
        console.log("🧪 handleAddPage 호출됨, uid:", uid, "title:", newPageTitle);

        if (!newPageTitle.trim()) return;
        try {
            const result = await addPage(uid, newPageTitle);
            if (result) {
                setNewPageTitle("");
                setIsAddingPage(false);
            } else {
                alert("페이지 추가 실패. 서버 응답 확인 필요");
            }
        } catch (error) {
            console.error("❌ 페이지 추가 실패:", error);
            alert("페이지 추가 중 오류 발생");
        }
        // if (!newPageTitle.trim()) return;
        // try {
        //     await addPage(uid, newPageTitle, loadPages);
        //     setNewPageTitle("");
        //     setIsAddingPage(false);
        // } catch (error) {
        //     console.error("❌ 페이지 추가 실패:", error);
        // }
    };

    // ✅ 편집 모드 활성화
    const handleStartEditing = (pid, currentTitle) => {
        setEditingPageId(pid);
        setNewPageTitle(currentTitle);
        setHoveredPid(null);
    };

    // ✅ 이름 변경 취소
    const handleCancelRename = () => {
        setEditingPageId(null);
        setNewPageTitle("");
    };

     // ✅ 페이지 이름 변경 (공통 함수 활용)
     const handleConfirmRename = async (pid) => {
        if (!newPageTitle.trim()) return;
        try {
            await renamePage(pid, newPageTitle, loadPages);
            setEditingPageId(null); // 편집 종료
            window.dispatchEvent(new Event("pageTitleUpdated")); // ✅ 이벤트 발생
        } catch (error) {
            console.error("❌ 페이지 이름 변경 실패:", error);
        }
    };

    // ✅ 페이지 순서 변경 (드래그앤드롭 반영)
    const movePage = async (dragIndex, hoverIndex) => {
        const updatedPages = [...sortedPages];
        const [movedPage] = updatedPages.splice(dragIndex, 1);
        updatedPages.splice(hoverIndex, 0, movedPage);
        
        setSortedPages(updatedPages);

        try {
            await updatePageOrder(updatedPages.map((page, index) => ({
                pid: page.pid,
                sort_order: index + 1,
            })));
            loadPages();
        } catch (error) {
            console.error("❌ 페이지 순서 업데이트 실패:", error);
        }
    };

    
    /* 사이드바 설정창 */
    // 📄 페이지 복제
    const handleDuplicatePage = async (pid) => {
        if (!uid) return;
        try {
            await duplicatePage(uid, pid);
            loadPages(); 
        } catch (error) {
            console.error("❌ 페이지 복제 실패:", error);
        }
    };
    


    // ✅ 즐겨찾기 추가/해제 함수
    const handleSwitchFavorite = async (pid, isFavorite) => {
        try {
            await switchFavorite(pid, isFavorite); // API 호출
            loadPages(); // 목록 갱신
        } catch (error) {
            console.error("❌ 즐겨찾기 변경 실패:", error);
        }
    };


    
    /*
        휴지통 
    */

    // ✅ 휴지통으로 이동 버튼을 통해 delete_yn='N' 업데이트
    const handleMoveToTrash = async (pid) => {
        try {
            await moveToTrash(pid, true); // ✅ API 요청
            loadPages(); // ✅ 전역 상태 업데이트
        } catch (error) {
            console.error("❌ 페이지 삭제 실패:", error);
        }
    };

   
    // ✅ 페이지 복원
    const handleRestorePage = async (pid) => {
        try {
            await restorePage(pid);
            loadPages();
            loadTrashPages();
        } catch (error) {
            console.error("❌ 페이지 복원 실패:", error);
        }
    };

    // ✅ 완전 삭제
    const handleDeletePermanently = async (pid) => {
        try {
            await deletePagePermanently(pid);
            loadTrashPages();
        } catch (error) {
            console.error("❌ 페이지 완전 삭제 실패:", error);
        }
    };

    // ✅ 휴지통 모달 열기
    const openTrash = async () => {
        await loadTrashPages(); 
        setShowTrash(true);
        setModalActive(true);
    };
    
    // ✅ 휴지통 모달 닫기
    const closeTrash = () => {
        setModalActive(false);
        setTimeout(() => setShowTrash(false), 300); 
    };

    const closePageSettings = () => {
        setShowPageSettings(null);
    };

    // ✅ 클릭 감지 함수 (모든 모달 통합 처리)
    useEffect(() => {
        const handleClickOutside = (event) => {
            // 휴지통 모달 닫기
            if (showTrash && modalRef.current && !modalRef.current.contains(event.target)) {
                closeTrash();
            }

            // 페이지 설정 모달 닫기
            if (showPageSettings !== null) {
                if (!event.target.closest(".pageSettings") && !event.target.closest(".settingsButton")) {
                    closePageSettings();
                }
            }
        };

        // 클릭 이벤트 등록
        document.addEventListener("mousedown", handleClickOutside);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showTrash, showPageSettings]);



    return (
        <DndProvider backend={HTML5Backend}>
            <div className={`sidebar-container ${isExpanded ? "expanded" : "collapsed"}`}>
                <div className="sidebar-header">
                    {!isExpanded && <button className="expandButton" onClick={() => setIsExpanded(true)}> <AiOutlineMenu />  </button>}
                    {isExpanded && <button className="collapseButton" onClick={() => setIsExpanded(false)}> <AiOutlineLeft />  </button>}
                </div>

                {isExpanded && (
                    <div className="sidebar">
                        <div className="button-container">
                            {isAddingPage ? (
                                <div className="newPageInput">
                                    <input type="text" placeholder="title" value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} />
                                    <button onClick={handleAddPage}>✔</button>
                                    <button onClick={() => setIsAddingPage(false)}>✖</button>
                                </div>
                            ) : (
                                <button className="addButton" onClick={() => setIsAddingPage(true)}>+ 페이지 추가</button>
                            )}
                        </div>

                        <div className="sidebar-content">
                            {sortedPages.length === 0 ? (
                                <div className="emptyMessage">페이지를 추가하세요</div>
                            ) : (
                                sortedPages.map((page, index) => (
                                    <PageItem
                                        key={page.pid}
                                        index={index}
                                        page={page}
                                        selectedPid={selectedPid}
                                        setSelectedPid={setSelectedPid}
                                        movePage={movePage}
                                        handleSelectedPage={handleSelectedPage}
                                        hoveredPid={hoveredPid}
                                        setHoveredPid={setHoveredPid}
                                        showPageSettings={showPageSettings}
                                        setShowPageSettings={setShowPageSettings}
                                        handleSwitchFavorite={handleSwitchFavorite} 
                                        handleMoveToTrash={handleMoveToTrash} 
                                        handleDuplicatePage={handleDuplicatePage}
                                        handleStartEditing={handleStartEditing} // ✅ 추가됨
                                        handleCancelRename={handleCancelRename} // ✅ 추가됨
                                        handleConfirmRename={handleConfirmRename} // ✅ 추가됨
                                        editingPageId={editingPageId} // ✅ 추가됨
                                        newPageTitle={newPageTitle} // ✅ 추가됨
                                        setNewPageTitle={setNewPageTitle}
                                    />
                                ))
                            )}
                        </div>

                        {/* 📌 휴지통 버튼 */}
                        <div className="trash-container" onClick={openTrash} ref={trashButtonRef}>
                            <AiOutlineDelete className="settingsIcon deleteIcon" /> 휴지통
                        </div>
{/* 
                        📌 휴지통 모달
                        {showTrash && (
                            <div className={`modal-overlay ${modalActive ? "active" : ""}`}>
                                <div className="trash-modal" ref={modalRef}>
                                    <button onClick={() => setShowTrash(false)}>닫기</button>
                                    <div className="trash-list">
                                        {trashList.length === 0 ? (
                                            <p>휴지통이 비어있습니다.</p>
                                        ) : (
                                            trashList.map((page) => (
                                                <div key={page.pid} className="trash-item">
                                                    <span className="trash-title">📄 {page.title}</span>
                                                    <div className="trash-button-container">
                                                        <button onClick={() => handleRestorePage(page.pid)}> <AiOutlineUndo /> </button>
                                                        <button onClick={() => handleDeletePermanently(page.pid)}> <AiOutlineDelete /> </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )} */}

                        {showTrash && (
                            <div className={`modal-overlay ${modalActive ? "active" : ""}`}>
                                <div className="trash-modal" ref={modalRef}>
                                    <button onClick={closeTrash}>닫기</button>
                                    <div className="trash-list">
                                        {trashList.length === 0 ? (
                                            <p>휴지통이 비어있습니다.</p>
                                        ) : (
                                            trashList.map((page) => (
                                                <div key={page.pid} className="trash-item">
                                                    <span className="trash-title">📄 {page.title}</span>
                                                    <div className="trash-button-container">
                                                        <button onClick={() => handleRestorePage(page.pid)}> <AiOutlineUndo /> </button>
                                                        <button onClick={() => handleDeletePermanently(page.pid)}> <AiOutlineDelete /> </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </DndProvider>
    );
};

const PageItem = ({ 
    page, 
    index, 
    selectedPid, 
    setSelectedPid, 
    movePage, 
    handleSelectedPage, 
    hoveredPid, 
    setHoveredPid, 
    showPageSettings, 
    setShowPageSettings,
    handleMoveToTrash,  
    handleSwitchFavorite,
    handleDuplicatePage,
    handleStartEditing,
    handleCancelRename,
    handleConfirmRename,
    editingPageId,
    newPageTitle,
    setNewPageTitle,
}) => {
    const ref = useRef(null);

    const [, drop] = useDrop({
        accept: "PAGE",
        hover: (draggedItem) => {
            if (draggedItem.index !== index) {
                movePage(draggedItem.index, index);
                draggedItem.index = index;
            }
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: "PAGE",
        item: { index },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    drag(drop(ref));

    return (
        <div 
            ref={ref}
            className={`pageItem ${selectedPid === page.pid ? "active" : ""}`}
            onClick={() => handleSelectedPage(page.pid, page.title)}
            onMouseEnter={() => { setHoveredPid(page.pid); }}
            onMouseLeave={() => { setHoveredPid(null); }}
            style={{ opacity: isDragging ? 0.5 : 1, cursor: "grab" }}
        >
            <span className="pageTitle"> 

            {page.is_favorite ? <AiFillStar className="pageIcon favoriteIcon" /> : <AiOutlineFile className="pageIcon" />}
            
             {/* ✅ 편집 모드일 경우 input 표시 */}
             {editingPageId === page.pid ? (
                    <input
                        type="text"
                        value={newPageTitle}
                        onChange={(e) => setNewPageTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConfirmRename(page.pid)}
                        autoFocus
                    />
                ) : (
                    page.title
                )}
            </span>

            {/* ✅ 편집 모드일 때만 체크 & 취소 버튼 표시 */}
            {editingPageId === page.pid && (
                <div className="renameActions">
                    <button className="confirmRenameBtn" onClick={() => handleConfirmRename(page.pid)}>✔</button>
                    <button className="cancelRenameBtn" onClick={handleCancelRename}>✖</button>
                </div>
            )}

            { editingPageId !== page.pid && hoveredPid === page.pid && (
                <div className="pageActions">
                    <button className="settingsButton" onClick={(e) => { e.stopPropagation(); setShowPageSettings(page.pid); handleStartEditing(null)}}>⋯</button>
                    <button className="duplicatePageButton" onClick={(e) => { e.stopPropagation(); handleDuplicatePage(page.pid); }}>+</button>
                </div>
            )}

            {/*  설정창 */}
            {showPageSettings === page.pid && (
                 <div id={`page-settings-${page.pid}`} className="pageSettings">
                    {/* ⭐ 즐겨찾기 추가/해제 */}
                    <button id={`fav-btn-${page.pid}`} className="settingsOption"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchFavorite(page.pid, !page.is_favorite);
                            setShowPageSettings(null);
                        }}>
                        {page.is_favorite ? (
                            <>
                                <AiFillStar className="favIcon active" style={{ marginRight: "8px" }} /> <span>즐겨찾기 해제</span>
                            </>
                        ) : (
                            <>
                                <AiOutlineStar className="favIcon" style={{ marginRight: "8px" }} /><span>즐겨찾기 추가</span>
                            </>
                        )}
                    </button>
            
                 {/* 📑 페이지 복제 */}
                 <button id={`duplicate-btn-${page.pid}`} className="settingsOption" 
                     onClick={(e) => { 
                         e.stopPropagation(); 
                         handleDuplicatePage(page.pid);
                         setShowPageSettings(null);
                     }}>
                     <AiOutlineCopy className="settingsIcon" /> 복제
                 </button>
         
                 {/* ✏ 이름 바꾸기 */}
                 <button id={`rename-btn-${page.pid}`} className="settingsOption" 
                     onClick={(e) => {
                         e.stopPropagation(); 
                         handleStartEditing(page.pid, page.title);
                         setShowPageSettings(null);
                     }}>  
                     <AiOutlineEdit className="settingsIcon" /> 이름 바꾸기
                 </button>
         
                 {/* 🗑 휴지통으로 이동 */}
                 <button id={`delete-btn-${page.pid}`} className="settingsOption" 
                     onClick={(e) => {
                         e.stopPropagation();
                         handleMoveToTrash(page.pid);
                         setShowPageSettings(null);
                     }}>
                     <AiOutlineDelete className="settingsIcon deleteIcon" /> 휴지통으로 이동
                 </button>
            </div>
            )}
        </div>
    );
};

export default Sidebar;

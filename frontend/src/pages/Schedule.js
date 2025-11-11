// import React, { useState, useEffect} from "react";
import React, { useEffect } from "react";
import { useAuth } from "../components/AuthContext";
import { usePageContext } from "../components/PageContext";
import BlockEditor from "../components/BlockEditor";


import styles from "../styles/schedule.module.css";

function Schedule() {
    const { isChecking, isAuthed } = useAuth();

    const {
        loadPages,
        blocks, setBlocks,
        loadBlocks, 
    } = usePageContext();
    
    // const uid = localStorage.getItem("uid");

    // 페이지 불러오기
    useEffect(() => {
        if (!isAuthed) return; 
        // if (!uid) return;
        loadPages();
        loadBlocks();
    }, [isAuthed, loadPages, loadBlocks]);
    
     if (isChecking) {
        return <div className={styles.container}><p>로딩 중…</p></div>;
    }


    return (
        <div className={styles.container}>
            <div className={styles.headerContainer}>
                <h1>당신의 하루를 채워보세요.</h1>
            </div>

            {isAuthed ? (
                <BlockEditor blocks={blocks} setBlocks={setBlocks} />
            ) : (
                <div className={styles.notice}>
                <p>로그인 후 이용 가능합니다.</p>
                </div>
            )}

            {/* ✅ 블록 에디터 */}
            {/* <BlockEditor 
                blocks={blocks} setBlocks={setBlocks}
            />
     */}
            {/* ✅ 페이지 리스트 출력 */}
            {/* <div className={styles.pageListContainer}>
                {!Array.isArray(sortedPages) || sortedPages.length === 0 ? (
                    <p>아직 생성된 페이지가 없습니다.</p>
                ) : (
                    sortedPages.map((page) => (
                        <div key={page.pid} className={styles.pageItem}>
                            📄 {page.title}
                        </div>
                    ))
                )}
            </div> */}
        </div>
    );
}

export default Schedule;

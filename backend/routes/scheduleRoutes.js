const express = require("express");
const db = require("../config/db");
const router = express.Router();

/* ----------------------------------- */
/* 공통 사용 API */
/* ----------------------------------- */

// 유효성 (간단 검증)
const COLORS = new Set(["default","gray","brown","orange","yellow","green","blue","purple","pink","red"]);
const MODES  = new Set(["text","bg"]);


// [1] 페이지 이름 변경 API (사이드바 , 상세페이지)
router.put("/pages/rename", async (req, res) => {
    const { pid, newTitle } = req.body;
    if (!pid || !newTitle.trim()) {
        return res.status(400).json({ success: false, message: "PID와 새로운 제목이 필요합니다." });
    }
    try {
        // 제목 업데이트
        const updateSql = "UPDATE nalp_page SET title = ? WHERE pid = ?";
        const [result] = await db.execute(updateSql, [newTitle, pid]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "페이지를 찾을 수 없습니다." });
        }

        console.log(`✅ 페이지(${pid}) 이름 변경 완료: ${newTitle}`);
        res.json({ success: true, message: "페이지 이름 변경 완료", pid, newTitle });
    } catch (error) {
        console.error("❌ 페이지 이름 변경 실패:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});

/**
 *   [2] 페이지 조회 API 
 *       스케쥴 페이지 / 사이드 바에서 생성된 상세페이지 불러오기
 */
router.get("/pages", async (req, res) => {
    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ success: false, message: "UID가 필요합니다." });
    }
    try {
        const sql = "SELECT * FROM nalp_page WHERE uid = ? AND delete_yn = 'N' ORDER BY sort_order ASC";
        const [pages] = await db.execute(sql, [uid]);
        res.json({ success: true, pages: pages.length ? pages : [] });
    } catch (error) {
        console.error("❌ 페이지 목록 조회 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});
/*
 [3] 페이지 추가 API - 사이드바 , 스케쥴 페이지에서 페이지 생성
*/
router.post("/pages", async (req, res) => {
    const { uid, title } = req.body;
    console.log("📌 요청 데이터:", req.body);
    if (!uid || !title.trim()) {
        console.log("❌ 필수 입력값 누락됨.");
        return res.status(400).json({ success: false, message: "UID와 제목이 필요합니다." });
    }
    try {
        // ✅ 현재 최대 sort_order 값 가져오기
        const [maxSort] = await db.execute("SELECT MAX(sort_order) AS max_order FROM nalp_page WHERE uid = ?", [uid]);
        const newSortOrder = (maxSort[0].max_order || 0) + 1; // 현재 최대값 + 1
        // ✅ 새 페이지 추가
        const sql = "INSERT INTO nalp_page (uid, title, sort_order) VALUES (?, ?, ?)";
        await db.execute(sql, [uid, title, newSortOrder]);

        console.log("✅ 페이지 추가 완료");
        res.json({ success: true, message: "페이지 추가 완료" });
    } catch (error) {
        console.error("❌ 페이지 추가 실패:", error);
        return res.status(500).json({ success: false, message: "페이지 추가 실패" });
    }
});

/* ----------------------------------- */
/*  스케쥴 페이지 API */
/* ----------------------------------- */
/*
 [1] 페이지 조회 API - 공통 라우터 사용
*/

/*
 [2] 페이지 상세 조회 API
*/
router.get("/pages/:pid", async (req, res) => {
    const { pid } = req.params;
    if (!pid) {
        return res.status(400).json({ success: false, message: "PID가 필요합니다." });
    }
    try {
        const sql = "SELECT * FROM nalp_page WHERE pid = ?";
        const [results] = await db.execute(sql, [pid]);

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "페이지를 찾을 수 없습니다." });
        }

        res.json({ success: true, page: results[0] });
    } catch (error) {
        console.error("❌ 스케줄 페이지 상세 조회 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});

/*
 [3] 페이지 생성 API - 공통함수 사용
*/

/*
 [4] [콜아웃] 페이지 소개 불러오기 API  - 스케쥴페이지
*/
router.get("/callout/:uid", async (req, res) => {
    const { uid } = req.params;

    if (!uid) return res.status(400).json({ success: false, message: "UID가 필요합니다." });

    try {
        const query = "SELECT callout FROM nalp_callout WHERE uid = ? AND pid Is NULL ";
        const [callouts] = await db.execute(query, [uid]);
        res.json(callouts.length > 0 ? callouts[0].callout : ""); 
    } catch (error) {
        console.error("❌ 콜아웃 조회 실패:", error);
        res.status(500).json({ success: false, message: "[스케쥴]콜아웃 조회 실패" });
    }
});


/*
[5] [콜아웃] 페이지 소개 불러오기 API - [상세페이지]
*/
router.get("/pages/:pid/callout/:uid", async (req, res) => {
    const { uid, pid } = req.params;

    if (!uid || !pid) return res.status(400).json({ success: false, message: "UID와 PID가 필요합니다." });

    try {
        const query = "SELECT callout FROM nalp_callout WHERE uid = ? AND pid = ?";
        const [callouts] = await db.execute(query, [uid, pid]);
        res.json(callouts.length > 0 ? callouts[0].callout : ""); 
    } catch (error) {
        console.error("❌ 콜아웃 조회 실패:", error);
        res.status(500).json({ success: false, message: "콜아웃 조회 실패" });
    }
});


/*
[6] [콜아웃] 페이지 소개 저장 API - [상세페이지]
  POST /schedule/callout/add
  POST /pages/:pid/callout/add
*/
router.post(["/schedule/callout/add", "/pages/:pid/callout/add"], async (req, res) => {
    const { uid, pid, callout } = req.body;
    if (!uid) return res.status(400).json({ success: false, message: "UID가 필요합니다." });

    try {
        const queryCheck = pid !== null 
            ? "SELECT cid FROM nalp_callout WHERE uid = ? AND pid = ?"
            : "SELECT cid FROM nalp_callout WHERE uid = ? AND pid IS NULL";
        const values = pid !== null ? [uid, pid] : [uid];

        const [existing] = await db.execute(queryCheck, values);

        if (existing.length > 0) {
            const queryUpdate = "UPDATE nalp_callout SET callout = ? WHERE cid = ?";
            await db.execute(queryUpdate, [callout, existing[0].cid]);
            return res.json({ success: true, message: "콜아웃 업데이트 완료" });
        }

        const queryInsert = "INSERT INTO nalp_callout (uid, pid, callout) VALUES (?, ?, ?)";
        await db.execute(queryInsert, [uid, pid, callout]);
        res.json({ success: true, message: "콜아웃 추가 완료" });
    } catch (error) {
        console.error("❌ 콜아웃 추가 실패:", error);
        res.status(500).json({ success: false, message: "콜아웃 추가 실패" });
    }
});


/* ----------------------------------- */
/* 일정 관련 API */
/* ----------------------------------- */

/**
 * [1] 일정 조회 API
 */
router.get("/schedules", async (req, res) => {
    const { uid, pid } = req.query;
    if (!uid || !pid) {
        return res.status(400).json({ success: false, message: "UID가 필요합니다." });
    }
    try {
        const sql = "SELECT * FROM nalp_schedule WHERE uid = ? AND pid = ? ORDER BY start_date ASC";
        const [results] = await db.execute(sql, [uid, pid]);

        res.json({ success: true, schedules: results });
    } catch (error) {
        console.error("❌일정 조회 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});

/**
 * [2] 일정 추가 API
 */
router.post("/schedules", async (req, res) => {
    const { uid, pid, title, description = null, start_date, end_date, tag = null } = req.body;
    if (!uid || !pid || !title || !start_date) {
        return res.status(400).json({ success: false, message: "필수 입력값이 없습니다." });
    }
    try {
        const sql = "INSERT INTO nalp_schedule (uid, pid, title, description, start_date, end_date, tag) VALUES (?, ?, ?, ?, ?, ?, ?)";
        await db.execute(sql, [uid, pid, title, description, start_date, end_date || start_date, tag]);
        res.json({ success: true, message: "✅ 일정이 추가되었습니다." });
    } catch (error) {
        console.error("❌ 일정 추가 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});

/**
 * [3] 페이지 별 일정 조회 
 */
router.get("/schedules/pages/:pid", async(req, res) => {
    const { uid } = req.query;
    const { pid } = req.params;

    if ( !uid || !pid ) {
        return res.status(400).json({ success: false, message: "UID 또는 PID 없음 "});
    }

    try {
        const sql = "SELECT * FROM nalp_schedule WHERE uid = ? AND pid = ? ORDER BY start_date ASC";
        const [results] = await db.execute(sql, [uid, pid]);
        console.log(`📢 PID=${pid} 일정 조회 결과:`, results.length > 0 ? results : "조회된 일정 없음");
        res.json({ success: true, schedules: results });
    } catch (error) {
        console.error("❌ 일정 조회 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});


/**
 * [4] 모달:  일정 상세 조회 
 */
router.get("/schedules/:sid", async (req, res) => {
    const { sid } = req.params;
    try {
        const sql = "SELECT * FROM nalp_schedule WHERE sid = ?";
        const [result] = await db.execute(sql, [sid]);
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "일정을 찾을 수 없습니다." });
        }
        res.json({ success: true, schedule: result[0] });
    } catch (error) {
        console.error("❌ 일정 조회 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});

/**
 * [5] 모달: 일정 수정 API
 */
router.put("/schedules/:sid", async (req, res) => {
    const { sid } = req.params;
    const { title, description, start_date, end_date, tag } = req.body;
    if (!title && !description && !start_date && !end_date && !tag) {
        return res.status(400).json({ success: false, message: "변경할 내용을 입력하세요." });
    }
    try {
        const sql = "UPDATE nalp_schedule SET title=?, description=?, start_date=?, end_date=?, tag=? WHERE sid=?";
        await db.execute(sql, [title, description, start_date, end_date, tag, sid]);
        res.json({ success: true, message: "✅ 일정이 수정되었습니다." });
    } catch (error) {
        console.error("❌ 일정 수정 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});


/**
 * [5] 모달: 일정 삭제 API
 */
router.delete("/schedules/:sid", async (req, res) => {
    const { sid } = req.params;
    try {
        const sql = "DELETE FROM nalp_schedule WHERE sid = ?";
        await db.execute(sql, [sid]);
        res.json({ success: true, message: "✅ 일정이 삭제되었습니다." });
    } catch (error) {
        console.error("❌ 일정 삭제 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});


/**
 * [6] 캘린더뷰 : 일정 날짜 변경 API (드래그앤드롭)
 */
router.patch("/schedules/:sid", async (req, res) => {
    const { start_date, end_date } = req.body;
    const { sid } = req.params;

    if (!sid || !start_date || !end_date) {
        return res.status(400).json({ message: "필수 데이터 누락" });
    }

    try {
        const query = "UPDATE nalp_schedule SET start_date = ?, end_date = ? WHERE sid = ?";
        await db.query(query, [start_date, end_date, sid]);

        res.json({ message: "일정이 이동되었습니다." });
    } catch (error) {
        console.error("DB 업데이트 오류:", error);
        res.status(500).json({ message: "서버 오류 발생" });
    }
});



/* ----------------------------------- */
/*  사이드바 관련 API */
/* ----------------------------------- */

/**
 * 
 * [0] 페이지 이름 변경API - 공통함수사용
 * [1] 페이지 조회 API - 공통함수사용
 */

/**
 * [2] 페이지 복제 API
 * 
 *  1️⃣ 원본 페이지 정보 가져오기
 *  2️⃣ 기존 복사본 개수 확인 (자동 넘버링)
 *  3️⃣ 기존 페이지들의 sort_order 업데이트 (원본 아래로 밀기)
 *  4️⃣ 새 페이지 추가 (복사본 생성, 원본 아래로 배치)
 *  5️⃣ 원본 페이지의 일정 데이터(`nalp_schedule`) 가져오기
 */
router.post("/pages/duplicate", async (req, res) => {
    const { uid, originalPid } = req.body;

    if (!uid || !originalPid) {
        return res.status(400).json({ success: false, message: "UID와 원본 페이지 ID가 필요합니다." });
    }

    try {
        // 1)  원본 페이지 정보 가져오기
        const [originalPage] = await db.execute("SELECT * FROM nalp_page WHERE pid = ?", [originalPid]);

        if (originalPage.length === 0) {
            return res.status(404).json({ success: false, message: "원본 페이지를 찾을 수 없습니다." });
        }

        let originalTitle = originalPage[0].title;
        let originalSortOrder = originalPage[0].sort_order;
        let isFavorite = originalPage[0].is_favorite; // ⭐ 즐겨찾기 여부 가져오기

        // 2) 기존 복사본 개수 확인 (자동 넘버링)
        const [copyCount] = await db.execute(`
            SELECT COUNT(*) AS count
            FROM nalp_page
            WHERE title LIKE ?`, [`${originalTitle} copy%`]);

        let maxCopyNumber = (copyCount[0].count || 0) + 1;
        let newTitle = `${originalTitle} copy${maxCopyNumber}`;

        let newSortOrder = 0;

        if (isFavorite) {
            //  즐겨찾기된 페이지라면 → 일반 페이지 리스트의 최상단에 배치
            const [highestNormalPage] = await db.execute("SELECT MIN(sort_order) AS minOrder FROM nalp_page WHERE is_favorite = 0");
            newSortOrder = highestNormalPage[0].minOrder ? highestNormalPage[0].minOrder - 1 : 1;  // 일반 페이지 중 가장 앞에 배치
        } else {
            //  일반 페이지라면 → 원본 페이지 바로 아래에 배치
            newSortOrder = originalSortOrder + 1;
            await db.execute("UPDATE nalp_page SET sort_order = sort_order + 1 WHERE sort_order > ?", [originalSortOrder]);
        }

        // 3) 복제된 페이지 추가
        const insertPageSql = "INSERT INTO nalp_page (uid, title, sort_order, is_favorite) VALUES (?, ?, ?, ?)";
        const [result] = await db.execute(insertPageSql, [uid, newTitle, newSortOrder, 0]);  // ⭐ 복제본은 즐겨찾기 해제 상태

        const newPageId = result.insertId;
        console.log("✅ 새 페이지 생성 완료: PID", newPageId);

        // 4) 원본 페이지의 일정 데이터(`nalp_schedule`) 가져오기
        const [originalSchedules] = await db.execute("SELECT * FROM nalp_schedule WHERE pid = ?", [originalPid]);

        if (originalSchedules.length > 0) {
            for (const schedule of originalSchedules) {
                await db.execute(`
                    INSERT INTO nalp_schedule (uid, pid, title, description, start_date, end_date, tag) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uid, newPageId, schedule.title, schedule.description || null,
                        schedule.start_date, schedule.end_date || schedule.start_date, schedule.tag || null
                    ]
                );
            }
            console.log(`✅ 원본 페이지(${originalPid})의 일정 데이터 복사 완료.`);
        } else {
            console.log(`ℹ️ 원본 페이지(${originalPid})에 복사할 일정 데이터가 없음.`);
        }

        res.json({ success: true, message: "페이지 복제 완료", page: { pid: newPageId, uid, title: newTitle, sort_order: newSortOrder, is_favorite: 0 } });

    } catch (error) {
        console.error("❌ 페이지 복제 실패:", error);
        return res.status(500).json({ success: false, message: "페이지 복제 실패" });
    }
});

/**
 *  [4] 휴지통 페이지 이동 API
 */
router.patch("/pages/delete", async (req, res) => {
    const { pid } = req.body;
    if (!pid) {
        return res.status(400).json({ success: false, message: "PID가 필요" });
    }

    try {
        const sql = "UPDATE nalp_page SET delete_yn = 'Y' WHERE pid = ?";
        await db.execute(sql, [pid]);
        res.json({ success: true, message: "페이지가 휴지통으로 이동되었습니다." });
    } catch (error) {
        console.error("❌ 페이지 삭제 오류:", error);
        return res.status(500).json({ success: false, message: "페이지 삭제 실패!" });
    }
});

/**
 *  [5] 휴지통 조회 (delete_yn = 'Y' 인 페이지 목록)
 */
router.get("/trash", async (req, res) => {

    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ success: false, message: "UID가 필요합니다." });
    }

    try {
        const sql = "SELECT * FROM nalp_page WHERE uid = ? AND TRIM(delete_yn) = 'Y' ORDER BY created_at DESC";
        const [pages] = await db.execute(sql, [uid]);

        console.log(`📢 [휴지통 조회 결과] UID ${uid}:`, pages);

        return res.json({ success: true, pages });

    } catch (error) {
        console.error("❌ 휴지통 조회 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});



/**
 *  [6] 휴지통 페이지 복원 API
 */
router.patch("/pages/restore", async (req, res) => {
    const { pid } = req.body;
    if (!pid) {
        return res.status(400).json({ success: false, message: "PID가 필요합니다." });
    }
    try {
        await db.execute("UPDATE nalp_page SET delete_yn = 'N' WHERE pid = ?", [pid]);
        res.json({ success: true, message: "✅ 페이지가 복원되었습니다." });
    } catch (error) {
        console.error("❌ 페이지 복원 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});

/**
 * [7] 휴지통에 들어간 페이지 완전 삭제 API
 */
router.delete("/pages/:pid", async (req, res) => {
    const { pid } = req.params;
    if (!pid) {
        return res.status(400).json({ success: false, message: "PID가 필요합니다." });
    }

    try {
        const sql = "DELETE FROM nalp_page WHERE pid = ?";
        await db.execute(sql, [pid]);

        res.json({ success: true, message: "페이지가 완전 삭제되었습니다." });
    } catch (error) {
        console.error("❌ 페이지 완전 삭제 오류:", error);
        return res.status(500).json({ success: false, message: "페이지 삭제 실패!" });
    }
});


/**
 *  [8] 30일 이상 지난 페이지 자동 삭제 (CRON JOB)
 */
router.delete("/pages/trash/auto-delete", async (req, res) => {
    try {
        const sql = "DELETE FROM nalp_page WHERE delete_yn = 'Y' AND created_at < NOW() - INTERVAL 30 DAY";
        const [result] = await db.execute(sql);
        res.json({ success: true, message: `✅ ${result.affectedRows}개의 페이지가 완전 삭제되었습니다.` });
    } catch (error) {
        console.error("❌ 자동 삭제 오류:", error);
        return res.status(500).json({ success: false, message: "서버 오류 발생!" });
    }
});


/**
 * [9] 즐겨찾기 추가/해제
 */
router.patch("/pages/favorite", async (req, res) => {
    const { isFavorite, pid} = req.body;

    if (!pid) {
        return res.status(400).json({ success: false, message: "PID가 필요합니다." });
    }

    try {
        await db.execute("UPDATE nalp_page SET is_favorite = ? WHERE pid = ? ", [ isFavorite , pid]);
        res.json({ success: true, message: `${pid} ${isFavorite ? "추가" : "해제" } 완료` })
    } catch (error) {
        console.error("❌ 즐겨찾기 업데이트 실패:", error);
        res.status(500).json({ success: false, message: "즐겨찾기 업데이트 실패" });
    }
});




/* ----------------------------------------------- */
/* 노션 기능 관련 API */
/* ----------------------------------------------- */

// =============================================
//  스케쥴 페이지용 블럭
// =============================================


/**
 * [공통] 블록 리인덱싱 정렬 : 간격 좁아졌을때 호출하여 순서정리
 */
async function reindexBlocks(conn) {
  console.log("[server] reindexBlocks start....");
  const [blocks] = await conn.query(
    `SELECT bid FROM nalp_schedule_block ORDER BY order_index ASC`
  );

  let newIndex = 1000;
  const step = 1000;

  for (const block of blocks) {
    await conn.query(
      `UPDATE nalp_schedule_block 
          SET order_index = ?
        WHERE bid = ?`,
      [newIndex, block.bid]
    );
    newIndex += step;
  }
    //  `UPDATE nalp_schedule_block 
    //       SET order_index = ?, updated_at = CURRENT_TIMESTAMP
    //     WHERE bid = ?`,
  console.log("[server] reindexBlocks completed...");
}

// [공통] 리인덱싱 API 라우터 (프론트 대응용)
router.post("/block/reindex", async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await reindexBlocks(conn);
    await conn.commit();
    res.status(200).json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error("[server] reindexBlocks failed... [error] ", err);
    res.status(500).json({ error: "[server] reindexBlocks error" });
  } finally {
    conn.release();
  }
});

/* 
 * [1] 블럭 조회 기능 
 */
router.get("/block", async (req, res) => {
    try {
      const [rows] = await db.query(
          `
              SELECT * 
                FROM nalp_schedule_block 
            ORDER BY order_index ASC
          `
      );
      res.status(200).json(rows);
    } catch (err) {
      console.error("[server] GET 블록 조회 실패: ", err);
      res.status(500).json({ error: "서버 오류" });
    }
  });

/* 
 * [1] 블럭 조회 기능 - 단일 조회 
 */
router.get("/block/:bid", async (req, res) => {
  const { bid } = req.params;
  try {
    const [rows] = await db.query(
      `
      SELECT * 
         FROM nalp_schedule_block 
        WHERE bid = ?
      `,
      [bid]
    );
    if (!rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[server] GET 단일 블록 조회 실패: ", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

/* 
 *  [2] 블럭 추가 기능  
 *   type 필수, content 기본 "", checked 기본 false
 */
router.post("/block", async (req, res) => {
  // const { type, content = "", order_index } = req.body;
  const { type, content = "", order_index, checked } = req.body;

  if (!type) return res.status(400).json({ error: "type은 필수입니다." });

  const conn = await db.getConnection();
  let didReindex = false;

  try {
    await conn.beginTransaction();

    let newOrderIndex = order_index;

    // order_index 없으면 맨뒤에 1000단위 간격으로 추가
    if (typeof newOrderIndex !== "number") {
      const [[{ maxOrder = 0 }]] = await conn.query(
        `SELECT MAX(order_index) as maxOrder FROM nalp_schedule_block`
      );
      newOrderIndex = maxOrder + 1000;
    }

    // 간격 좁음 감지
    // const [[prev], [next]] = await Promise.all([
    const [[prevRows], [nextRows]] = await Promise.all([
      conn.query(
        `
             SELECT order_index 
               FROM nalp_schedule_block 
              WHERE order_index < ? 
           ORDER BY order_index DESC 
              LIMIT 1
        `,
        [newOrderIndex]
      ),
      conn.query(
        `
            SELECT order_index 
              FROM nalp_schedule_block 
             WHERE order_index > ? 
          ORDER BY order_index ASC 
             LIMIT 1
        `,
        [newOrderIndex]
      )
    ]);

    const prev = prevRows[0];
    const next = nextRows[0];

    if (
      prev?.order_index !== undefined &&
      next?.order_index !== undefined &&
      next.order_index - prev.order_index < 0.0001
    ) {
      console.log("⚠️ [server] POST 블럭 추가 - 간격 좁음 reindexBlocks start...");
      await reindexBlocks(conn);
      didReindex = true;

      // 리인덱싱 후 새 order_index 재계산
      const [[{ maxOrder = 0 }]] = await conn.query(
        `SELECT MAX(order_index) as maxOrder FROM nalp_schedule_block`
      );
      // newOrderIndex = maxOrder + 1000;
      newOrderIndex = (maxOrder || 0) + 1000;
    }

    // 블록 추가
    // const [result] = await conn.query(
    //   `INSERT INTO nalp_schedule_block (type, content, order_index) VALUES (?, ?, ?)`,
    //   [type, content, newOrderIndex]
    // );

    //블록 추가 (checked는 체크리스트 외 0으로 반영) 
    const checkedVal = Number(!!checked);
    const [result] = await conn.query(
      `
        INSERT INTO nalp_schedule_block (type, content, order_index, checked)
             VALUES (?, ?, ?, ?)
      `,
      [type, content, newOrderIndex, checkedVal]
    );

    await conn.commit();
    res.status(201).json({
      bid: result.insertId,
      type,
      content,
      order_index: newOrderIndex,
      checked: checkedVal,
      reindexed: didReindex, // 리인덱싱여부
    });

  } catch (err) {
    await conn.rollback();
    console.error("[server] POST 블록 추가 실패: ", err);
    res.status(500).json({ error: "서버 오류" });
  } finally {
    conn.release();
  }
});


/**
 * [3] 블록 내용 업데이트 - 공통
 */
router.put("/block/content", async (req, res) => {
    const { bid, content } = req.body;
    if (!bid) return res.status(400).json({ error: "[server] bid가 존재하지 않습니다." });
  
    try {
      const updates = [];
      const values = [];
  
      if (content !== undefined) {
        updates.push("content = ?");
        values.push(content);
      }
  
      if (updates.length === 0) {
        return res.status(400).json({ error: "업데이트할 필드가 없습니다." });
      }
  
      values.push(bid);
  
      const sql = `UPDATE nalp_schedule_block SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE bid = ?`;
      await db.query(sql, values);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("[server] PUT 블럭 수정 실패:", err);
      res.status(500).json({ error: "서버 오류" });
    }
  });


/**
 * [4] 블록 타입 업데이트
 */
router.put('/block/type', async (req, res) => {
  const { bid, type } = req.body;
  // console.log("🔥 [PUT /block/type] req.body:", req.body);
  // console.log("✅ [PUT /block/type] 요청 수신:", { bid, type });

  if (!bid || !type) {
    return res.status(400).json({ error: "bid, type은 필수입니다." });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // [1] 타입 업데이트
    await conn.execute(
      `UPDATE nalp_schedule_block 
          SET type = ? 
             , updated_at = CURRENT_TIMESTAMP
        WHERE bid = ?`,
      [type, bid]
    );

    // [2] checklist 타입이면 초기 항목 1개 생성
    // if (type === "checklist") {
    //   await conn.execute(
    //     `INSERT INTO nalp_checklist (bid, content, order_index) VALUES (?, '', 1000)`,
    //     [bid]
    //   );
    // }

    // [3] 블록 재조회하여 data로 반환
    const [rows] = await conn.execute(
      `SELECT * FROM nalp_schedule_block WHERE bid = ?`,
      [bid]
    );
    await conn.commit();
    return res.status(200).json({ data: rows[0] }); 
  } catch (error) {
    await conn.rollback();
    console.error('[server] PUT 블록 타입 업데이트 실패: ', error);
    return res.status(500).json({ message: '서버 에러' });
  } finally {
    conn.release();
  }
});


/** 
 *  [4] 체크 토글 : 체크박스 상태 업데이트 { bid, checked}
 */
router.put("/block/checked", async (req, res) => {
  const { bid, checked } = req.body;
  if (!bid || checked === undefined) {
    return res.status(400).json({ error: "bid, checked는 필수입니다." });
  }
  try {
    const [rows] = await db.query(
      `
        SELECT bid, type
          FROM nalp_schedule_block
         WHERE bid = ?
      `, [bid]
    );
    
    const block = rows[0];
    
    if (!block) {
      return res.status(404).json({ error : "NOT_FOUND "});
    }

    if (block.type !== "checklist") {
      return res.status(400).json({ error: "이 블록은 checklist 타입이 아닙니다." });
    }

    await db.query(
      `UPDATE nalp_schedule_block 
          SET checked = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE bid = ?`, [Number(!!checked), bid]
    );
    return res.json({ success: true, bid, checked: !!checked});
  } catch (err) {
    console.error("[server] PUT 체크 토글 실패:", err);
    res.status(500).json({ error: "서버 오류" });
  }
});


/**
 *  [4-1] 체크박스 상태 토글
 * - param : bid
 * - 현재 checked 반영
 */
router.post("/block/:bid/checked/toggle", async (req, res) => {
  const { bid } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT bid, type, checked FROM nalp_schedule_block WHERE bid = ?`,
      [bid]
    );
    const block = rows[0];
    if (!block) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    if (block.type !== "checklist") {
      return res.status(400).json({ error: "이 블록은 checklist 타입이 아닙니다." });
    }

    const nextChecked = block.checked ? 0 : 1;

    await db.query(
      `UPDATE nalp_schedule_block 
          SET checked = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE bid = ?`,
      [nextChecked, bid]
    );

    return res.json({ success: true, bid: Number(bid), checked: !!nextChecked });
  } catch (err) {
    console.error("[server] POST /block/:bid/checked/toggle 실패:", err);
    return res.status(500).json({ error: "서버 오류" });
  }
});

/**
 *  [5] 블럭 삭제 기능 
 */
router.delete("/block/:bid", async (req, res) => {
  const { bid } = req.params;
  try {
    const [result] = await db.query(
      `DELETE FROM nalp_schedule_block WHERE bid = ?`,
      [bid]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[server] DELETE 블록 삭제 실패:", err);
    res.status(500).json({ error: "서버 오류" });
  }
});


/**
 *  [6] 블록 드래그앤 드롭 순서업데이트 기능
 */
router.patch("/block/order", async (req, res) => {
  const { bid, prevOrder, nextOrder } = req.body;

  if (!bid || prevOrder === undefined || nextOrder === undefined) {
    return res.status(400).json({ error: "필수 데이터 누락" });
  }

  const conn = await db.getConnection();
  let didReindex = false;

  try {
    await conn.beginTransaction();

    const newOrderIndex = (prevOrder + nextOrder) / 2;

    //  간격 좁음 감지
    if (nextOrder - prevOrder < 0.0001) {
      console.log("⚠️ 드래그앤드롭 간격 좁음 → 리인덱싱 실행");
      await reindexBlocks(conn);
      didReindex = true;
    }

    //  블록 순서 업데이트
    await conn.query(
      `UPDATE nalp_schedule_block SET order_index = ? WHERE bid = ?`,
      [newOrderIndex, bid]
    );

    await conn.commit();
    res.status(200).json({ success: true, reindexed: didReindex });
  } catch (err) {
    await conn.rollback();
    console.error("[server] 블록 순서 업데이트 실패:", err);
    res.status(500).json({ error: "서버 오류" });
  } finally {
    conn.release();
  }
});

// ======================================================
// [8] 드래그앤드롭: 단일 블록 재정렬
//  - prevBid/nextBid 사이로 이동
//  - 맨앞/맨뒤 이동 처리
//  - 간격좁음 시 리인덱싱
// ======================================================
router.post("/block/reorder", async (req, res) => {
  const { bid, prevBid, nextBid } = req.body;
  if (!bid) return res.status(400).json({ error: "bid는 필수입니다." });

  const conn = await db.getConnection();
  let didReindex = false;

  try {
    await conn.beginTransaction();

    const [[cur]] = await conn.query(
      `SELECT bid, order_index FROM nalp_schedule_block WHERE bid = ?`,
      [bid]
    );
    if (!cur) {
      await conn.rollback();
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const [[prev]] = prevBid
      ? await conn.query(
          `SELECT bid, order_index FROM nalp_schedule_block WHERE bid = ?`,
          [prevBid]
        )
      : [[null]];

    const [[next]] = nextBid
      ? await conn.query(
          `SELECT bid, order_index FROM nalp_schedule_block WHERE bid = ?`,
          [nextBid]
        )
      : [[null]];

    let newOrderIndex;

    if (prev && next) {
      const gap = next.order_index - prev.order_index;
      if (gap < 0.0001) {
        await reindexBlocks(conn);
        didReindex = true;

        const [[p]] = await conn.query(
          `SELECT order_index FROM nalp_schedule_block WHERE bid = ?`,
          [prevBid]
        );
        const [[n]] = await conn.query(
          `SELECT order_index FROM nalp_schedule_block WHERE bid = ?`,
          [nextBid]
        );
        newOrderIndex = (p.order_index + n.order_index) / 2;
      } else {
        newOrderIndex = (prev.order_index + next.order_index) / 2;
      }
    } else if (prev && !next) {
      // 맨 뒤
      newOrderIndex = prev.order_index + 1000;
    } else if (!prev && next) {
      // 맨 앞
      newOrderIndex = next.order_index - 1000;
      if (newOrderIndex <= 0) {
        await reindexBlocks(conn);
        didReindex = true;
        const [[n]] = await conn.query(
          `SELECT order_index FROM nalp_schedule_block WHERE bid = ?`,
          [nextBid]
        );
        newOrderIndex = n.order_index - 1000;
      }
    } else {
      // prev/next 둘 다 없음 → 단일 리스트
      newOrderIndex = 1000;
    }

    await conn.query(
      `UPDATE nalp_schedule_block 
          SET order_index = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE bid = ?`,
      [newOrderIndex, bid]
    );

    await conn.commit();
    res.json({ success: true, bid, order_index: newOrderIndex, reindexed: didReindex });
  } catch (err) {
    await conn.rollback();
    console.error("[server] POST /block/reorder 오류:", err);
    res.status(500).json({ error: "서버 오류" });
  } finally {
    conn.release();
  }
});


// ======================================================
// [9] 드래그앤드롭: 배치 재정렬
//  - 프론트 최종 순서를 서버에서 1000 step으로 재부여(일관성 보장)
// ======================================================
router.post("/block/reorder/batch", async (req, res) => {
  const { items } = req.body; // [{ bid }, ...] 최종 순서
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items는 필수입니다." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let idx = 1000;
    for (const it of items) {
      await conn.query(
        `UPDATE nalp_schedule_block 
            SET order_index = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE bid = ?`,
        [idx, it.bid]
      );
      idx += 1000;
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error("[server] POST /block/reorder/batch 오류:", err);
    res.status(500).json({ error: "서버 오류" });
  } finally {
    conn.release();
  }
});



// ======================================================
// [10] 콜아웃 블록 입력 수정
// ======================================================
router.put("/block/callout", async (req, res) => {
  try {
    const { bid, mode, color, iconId } = req.body || {};
    if (!bid) return res.status(400).json({ ok: false, error: "bad request" });

    const [rows0] = await db.query("SELECT meta FROM nalp_schedule_block WHERE bid = ?", [bid]);
    const prevMeta = rows0?.[0]?.meta ? JSON.parse(rows0[0].meta) : {};
    const prevCO   = prevMeta.callout || {};

    const MODE_OK = (m) => m === "text" || m === "bg";
    const COLORS = new Set(["default","gray","brown","orange","yellow","green","blue","purple","pink","red"]);

    const nextCO = {
      mode  : MODE_OK(mode) ? mode : prevCO.mode,
      color : COLORS.has(color) ? color : prevCO.color,
      iconId: (Number.isInteger(iconId) && iconId >= 0 && iconId <= 9) ? iconId : prevCO.iconId,
    };


    const nextMeta = { ...prevMeta, callout: nextCO };

    await db.query(
      "UPDATE nalp_schedule_block SET meta = CAST(? AS JSON) WHERE bid = ?",
      [JSON.stringify(nextMeta), bid]
    );

    const [rows] = await db.query(
      "SELECT bid, type, content, meta, order_index, checked FROM nalp_schedule_block WHERE bid = ?",
      [bid]
    );

    const block = rows?.[0] || null;

    if (block?.meta && typeof block.meta === "string") {
      try { block.meta = JSON.parse(block.meta); } catch {}
    }
    res.json({ ok:true, block });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "server error" });
  }
});




/* ----------------------------------- */
/*  체크리스트 API                        */
/* ----------------------------------- */
// [1] 체크리스트 조회 GET 
// [ * ] 체크리스트 블록 리인덱싱: 순서재정렬
// [* - 2 ] 리인덱싱 프론트
//  [2] 체크리스트 항목 추가
// [3] 체크리스트 수정
//  [4] 체크리스트 삭제
//  [5] 체크리스트 순서 재설정

module.exports = router;
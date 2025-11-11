const mysql = require("mysql2/promise");
require("dotenv").config();

// MySQL 연결 설정
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 연결 테스트
// db.getConnection((err, connection) => {
//     if (err) {
//         console.error("[server] MySQL failed...: ", err);
//     } else {
//         console.log("[server] MySQL connected...");
//         connection.release();
//     }
// });
(async () => {
    try {
        const connection = await db.getConnection();
        console.log("[server] ✅ MySQL 연결 성공!");
        connection.release(); // ✅ 연결 해제
    } catch (err) {
        console.error("[server] ❌ MySQL 연결 실패:", err);
    }
})();

// module.exports = db.promise(); 
module.exports = db; 
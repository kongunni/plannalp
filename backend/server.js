require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
require("./config/passportConfig")(passport);
const KakaoStrategy = require("passport-kakao").Strategy;
const db = require("./config/db");
const scheduleRoutes = require("./routes/scheduleRoutes"); 

const app = express();
const PORT = process.env.PORT || 5001;

app.use(session({
    secret: process.env.SESSION_SECRET || "mysecret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// app.use(cors());
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());
app.use("/api", scheduleRoutes);

db.getConnection((err, connection) => {
    if (err) {
        console.error("🚨 MySQL 연결 실패:", err);
    } else {
        console.log("✅ MySQL 연결 성공!");
        connection.release();
    }
});

passport.serializeUser((user, done) => {
    done(null, user.uid);
});

passport.deserializeUser(async (uid, done) => {
    try {
        const [results] = await db.query("SELECT * FROM nalp_user WHERE uid = ?", [uid]);
        return done(null, results[0]);
    } catch (err) {
        return done(err);
    }
});

const generateToken = (user) => {
    return jwt.sign({ id: user.uid, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

passport.use(new KakaoStrategy({
    clientID: process.env.KAKAO_CLIENT_ID,
    clientSecret: "",
    callbackURL: process.env.KAKAO_REDIRECT_URI
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log("🔥 카카오 프로필 정보:", profile);

        const email = profile._json.kakao_account.email || `kakao_${profile.id}@example.com`;

        // ✅ `email`을 기반으로 회원 정보 가져오기
        const [existingUser] = await db.query(
            "SELECT * FROM nalp_user WHERE email = ? AND social_type = 'kakao'",
            [email]
        );

        if (existingUser.length > 0) {
            console.log("✅ 기존 회원 로그인:", existingUser[0]);
            return done(null, { ...existingUser[0], newUser: false });  // ✅ 기존 회원 처리
        }

        // ✅ 신규 회원일 경우
        console.log("❌ 신규 회원: 회원가입 필요");
        return done(null, { email, newUser: true });

    } catch (error) {
        return done(error);
    }
}));

app.get("/auth/kakao/callback", passport.authenticate("kakao", { failureRedirect: "/" }), async (req, res) => {
    console.log("✅ 카카오 로그인 완료, 사용자 정보:", req.user);

    try {
        const { email } = req.user;
        const state = req.query.state; // 🚨 "register"인지 확인

        if (!email) {
            console.log("❌ 이메일을 가져올 수 없음");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=email_not_found`);
        }

        // ✅ 기존 회원 조회
        const [user] = await db.query(
            "SELECT * FROM nalp_user WHERE email = ? AND social_type = 'kakao'",
            [email]
        );

        if (state === "register") {
            // ✅ 기존 회원이 회원가입 버튼을 누른 경우 → 회원가입 차단
            if (user.length > 0) {
                console.log("❌ 이미 가입된 계정입니다. 회원가입 불가");
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=already_registered`);
            }

            // ✅ 신규 회원 → 회원가입 페이지로 리디렉트
            console.log("❌ 신규 회원: 회원가입 필요");
            return res.redirect(`${process.env.FRONTEND_URL}/kakao-register?email=${email}`);
        }

        if (user.length > 0) {
            // ✅ 기존 회원 로그인 처리
            console.log("✅ 기존 회원 로그인 처리 시작");

            const token = generateToken(user[0]); // 🔥 JWT 토큰 생성

             // 🔥 여기 추가
            console.log("✅ 로그인 성공, 발급된 토큰:", token);
            console.log("✅ 로그인된 사용자 uid:", user[0].uid);
            console.log("✅ 최종 리디렉션 URL:",
                `${process.env.FRONTEND_URL}/kakao-redirect?token=${token}&uid=${user[0].uid}`);


            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict"
            });

            console.log("✅ 로그인 성공, 토큰 발급 완료");
            // return res.redirect(`${process.env.FRONTEND_URL}/kakao-redirect?token=${token}`);
            return res.redirect(`${process.env.FRONTEND_URL}/kakao-redirect?token=${token}&uid=${user[0].uid}`);
        }

        // ✅ 신규 회원이면 `/kakao-register`로 이동
        console.log("❌ 신규 회원: 회원가입 필요");
        return res.redirect(`${process.env.FRONTEND_URL}/kakao-register?email=${email}`);

    } catch (err) {
        console.error("❌ 로그인 처리 중 오류 발생:", err);
        return res.status(500).json({ message: "서버 오류 발생!" });
    }
});

// ✅ 이메일 중복 체크 API (일반 회원가입 포함)
app.post("/check-email", async (req, res) => {
    console.log("📌 요청받은 데이터: ", req.body);
    const { email } = req.body;
    
    if (!email) {
        console.log("📌 이메일 전달 실패");
        return res.status(400).json({ success: false, message: "이메일이 제공되지 않았습니다." });
    }
    
    console.log("📌 백엔드에서 받은 이메일:", email);

    try {
        // ✅ 일반 회원 & 카카오 회원 중복 여부 확인
        const [existingUser] = await db.query(
            "SELECT * FROM nalp_user WHERE email = ?", [email]
        );

        if (existingUser.length > 0) {
            console.log("✅ 기존 회원 확인됨:", existingUser[0]);
            return res.json({ exists: true, message: "이미 사용 중인 이메일입니다." });
        } else {
            console.log("❌ 신규 회원: 회원가입 가능");
            return res.json({ exists: false, message: "사용 가능한 이메일입니다." });
        }
    } catch (err) {
        console.error("❌ 이메일 중복 체크 중 오류 발생:", err);
        res.status(500).json({ message: "서버 오류 발생!" });
    }
});



// 회원가입 API - kakao
app.post("/kakao-register", async (req, res) => {
    const { name, email } = req.body;

    try {
        // ✅ 기존 회원 조회
        const [existingUser] = await db.query(
            "SELECT * FROM nalp_user WHERE email = ? AND social_type = 'kakao'",
            [email]
        );

        if (existingUser.length > 0) {
            console.log("❌ 이미 가입된 계정입니다. 회원가입 불가");
            return res.status(400).json({ success: false, message: "이미 등록된 계정입니다." });
        }

        // ✅ 신규 회원 처리
        const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
        await db.query(
            "INSERT INTO nalp_user (uname, email, password, social_type) VALUES (?, ?, ?, 'kakao')",
            [name, email, hashedPassword]
        );

        console.log("✅ 카카오 회원가입 성공");
        res.json({ success: true, message: "회원가입이 완료되었습니다!" });

    } catch (err) {
        console.error("❌ 회원가입 오류:", err);
        res.status(500).json({ message: "서버 오류 발생!" });
    }
});

// ✅ 카카오 회원가입 시 이름 업데이트
app.post("/update-kakao-name", async (req, res) => {
    const { name, email } = req.body;

    try {
        const [existingUser] = await db.query(
            "SELECT * FROM nalp_user WHERE email = ? AND social_type = 'kakao'",
            [email]
        );

        if (existingUser.length === 0) {
            return res.status(400).json({ success: false, message: "가입된 계정이 없습니다." });
        }

        await db.query("UPDATE nalp_user SET uname = ? WHERE email = ?", [name, email]);

        res.json({ success: true, message: "이름이 업데이트되었습니다!" });
    } catch (err) {
        console.error("❌ 서버 오류:", err);
        res.status(500).json({ message: "서버 오류 발생!" });
    }
});

app.post("/register", async (req, res) => {
    const { uname, email, password } = req.body;

    // ✅ 입력값 검증
    if (!/^[가-힣]{2,6}$/.test(uname)) {
        return res.status(400).json({ success: false, message: "이름은 한글 2~6자 이내여야 합니다." });
    }
    if (!/^[A-Za-z\d!@_\-\.=]{6,}$/.test(password)) {
        return res.status(400).json({ success: false, message: "비밀번호는 최소 6자 이상, 숫자/영어/특수문자(!@_- .=)만 가능합니다." });
    }

    try {
        // ✅ 이메일 중복 확인
        const [existingUser] = await db.query("SELECT * FROM nalp_user WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: "이미 가입된 이메일입니다." });
        }

        // ✅ 비밀번호 해싱 후 저장
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query("INSERT INTO nalp_user (uname, email, password, social_type) VALUES (?, ?, ?, 'normal')", 
            [uname, email, hashedPassword]
        );

        console.log("✅ 일반 회원가입 성공:", email);
        res.json({ success: true, message: "회원가입이 완료되었습니다!" });

    } catch (err) {
        console.error("❌ 회원가입 오류:", err);
        res.status(500).json({ message: "서버 오류 발생!" });
    }
});

app.use((req, res, next) => {
    console.log(`📌 요청 수신: ${req.method} ${req.url}`);
    next();
});


app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}에서 실행 중`);
});

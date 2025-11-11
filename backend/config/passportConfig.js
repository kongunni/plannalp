const KakaoStrategy = require("passport-kakao").Strategy;

module.exports = (passport) => {
    passport.use(
        new KakaoStrategy(
            {
                clientID: process.env.KAKAO_CLIENT_ID,
                callbackURL: process.env.KAKAO_CALLBACK_URL,
            },
            (accessToken, refreshToken, profile, done) => {
                const user = {
                    id: profile.id,
                    email: profile.id + "@kakao.com",
                    name: profile.username,
                };
                return done(null, user);
            }
        )
    );

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
};
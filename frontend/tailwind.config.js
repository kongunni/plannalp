/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",  // ✅ Tailwind가 적용될 파일들
      "./public/index.html",
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  };
  
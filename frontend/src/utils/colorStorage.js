// 기본 태그 색상 (사용자가 변경 가능)
const defaultTagColors = {
    "업무": "#FF6B6B",
    "운동": "#4D96FF",
    "여행": "#FFD166",
    "기타": "#06D6A0",
};

// 사용자가 지정한 색상을 저장
const userTagColors = JSON.parse(localStorage.getItem("userTagColors")) || {};

// 태그 색상 가져오기
export const getTagColor = (tag) => {
    return userTagColors[tag] || defaultTagColors[tag] || "#6C757D";  // 기본 회색
};

// 태그 색상 저장
export const setTagColor = (tag, color) => {
    if (!tag) return;
    userTagColors[tag] = color;
    localStorage.setItem("userTagColors", JSON.stringify(userTagColors));
};

// ✅ 배경 색상에 따라 텍스트 색상 결정 (어두우면 흰색, 밝으면 회색)
export const getTextColor = (backgroundColor) => {
    if (!backgroundColor) return "#333"; // 기본적으로 어두운 글씨
    const hex = backgroundColor.replace("#", ""); // "#" 제거
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000; // 밝기 계산
    return brightness < 128 ? "#fff" : "#333"; // 밝기 임계값 128 기준
};
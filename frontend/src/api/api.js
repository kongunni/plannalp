import axios from "axios";

const API_URL = "http://localhost:5001"; // 백엔드 주소

export const fetchData = async () => {
    try {
        const response = await axios.get(`${API_URL}/`);
        return response.data;
    } catch (error) {
        console.error("API 요청 실패:", error);
    }
};
import { useState, useEffect } from "react";
import { fetchBlocks } from "../services/TestService";

export default function useTestBlockEditor(bid) {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (bid) {
      fetchBlocks(bid).then(setBlocks);
    }
  }, [bid]);

  return { blocks, setBlocks };
}
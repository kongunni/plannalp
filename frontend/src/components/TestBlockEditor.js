import React, { useState, useRef, useEffect } from "react";
import useTestBlockEditor from "../components/useTestBlockEditor";
import { addBlock } from "../services/TestService";
import "../styles/global.css";

const blockCommands = [
  { type: "title1", label: "/제목1" },
  { type: "title2", label: "/제목2" },
  { type: "title3", label: "/제목3" },
  { type: "checklist", label: "/할 일 목록" },
  { type: "callout", label: "/콜아웃" },
  { type: "toggle", label: "/토글" },
  { type: "page", label: "/페이지" },
  { type: "quote", label: "/인용" },
  { type: "divider", label: "/구분선" },
];

const EditableBlock = ({ block, onCommandExecute, updateBlockContent }) => {
  const editableRef = useRef(null);
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(blockCommands);

  const handleInput = async (e) => {
    const value = e.target.innerText;

    if (value.startsWith("/")) {
      setShowCommands(true);
      setFilteredCommands(
        blockCommands.filter((cmd) =>
          cmd.label.toLowerCase().includes(value.toLowerCase())
        )
      );
    } else {
      setShowCommands(false);
      await updateBlockContent(block.bid, block.order_index, value);
    }
  };

  const handleCommandSelect = (cmd) => {
    onCommandExecute(cmd, block);
    if (editableRef.current) editableRef.current.innerText = "";
    setShowCommands(false);
  };

  return (
    <div className="block">
      <div className="block-content">
        <div
          className="block-editor-wrapper editable"
          contentEditable
          ref={editableRef}
          onInput={handleInput}
          data-placeholder="명령어를 입력하여 페이지를 작성해보세요"
        ></div>
        {showCommands && (
          <div className="commandDropdown">
            {filteredCommands.map((cmd) => (
              <div
                key={cmd.type}
                className="commandItem"
                onClick={() => handleCommandSelect(cmd)}
              >
                {cmd.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TestBlockEditor = ({ bid }) => {
  const { blocks, setBlocks } = useTestBlockEditor(bid);

  // 페이지 진입 시 블록 없으면 첫 블록 자동 생성
  useEffect(() => {
    const init = async () => {
      if (!blocks || blocks.length === 0) {
        const first = await addBlock(bid, "title1", 0);
        setBlocks([first]);
      }
    };
    init();
  }, [bid, blocks, setBlocks]);

  const updateBlockContent = async (bid, orderIndex, content) => {
    const updated = blocks.map((b) =>
      b.bid === bid && b.order_index === orderIndex
        ? { ...b, content }
        : b
    );
    setBlocks(updated);
  };

  const handleCommandExecute = async (cmd, block) => {
    const newBlock = await addBlock(bid, cmd.type);
    if (newBlock) {
      setBlocks((prev) => [...prev, newBlock]);
    }
  };

  return (
    <div className="block-container">
      <div className="block-section">
        <div className="block-list">
          {blocks.map((block) => (
            <EditableBlock
              key={block.order_index}
              block={block}
              onCommandExecute={handleCommandExecute}
              updateBlockContent={updateBlockContent}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestBlockEditor;

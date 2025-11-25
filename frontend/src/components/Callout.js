// 콜아웃 기능 분리
const DEFAULT_ICON = "💡";
export const CALLOUT_ICONS = ["💡","⚠️","✅","❗","📌","📝","🔔","🔒","🧭","🧪"];

// ID(0~9) → 문자
export const ICON_ID_TO_CHAR = (id) =>
  Number.isInteger(id) && id >= 0 && id < CALLOUT_ICONS.length
    ? CALLOUT_ICONS[id]
    : DEFAULT_ICON;

// 문자 → ID(없으면 -1)
export const ICON_CHAR_TO_ID = (ch) => {
  const i = CALLOUT_ICONS.indexOf(ch);
  return i >= 0 ? i : -1;
};

// 색상
const COLORS = ["default","gray","brown","orange","yellow","green","blue","purple","pink","red"];
const RECENT_KEY = "callout_recent_colors"; // [{mode:"text"|"bg", color:"yellow"}...]

// 색상 저장 및 로드
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0,5))); } catch {}
}
function pushRecent(mode, color) {
  const cur = loadRecent();
  const key = `${mode}:${color}`;
  const filtered = cur.filter(v => `${v.mode}:${v.color}` !== key);
  filtered.unshift({ mode, color });
  saveRecent(filtered);
}


// 스타일 적용
function applyCalloutStyle(root, meta) {
  const m = meta?.callout || {};
  const mode = m.mode === "text" ? "text" : "bg"; // 기본 bg
  const color = m.color || "default";
  root.classList.add(`callout--${mode}`, `callout--${color}`);
}

// 표시 아이콘 계산
function getDisplayIcon(meta) {
  const m = meta?.callout || {};
  if (Number.isInteger(m.iconId)) return ICON_ID_TO_CHAR(m.iconId);
  if (typeof m.icon === "string" && m.icon) return m.icon; // 구버전
  return DEFAULT_ICON;
}

/* ==== 동그라미 스와치 DOM ==== */
function makeSwatch({ label, mode, color, onPick }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `co-swatch co-swatch--${mode} co-swatch--${color}`;
  btn.title = `${label}`;
  btn.addEventListener("click", () => onPick(mode, color));
  return btn;
}


/* ==== 아이콘 버튼 ==== */
function makeIconButton(id, onPick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "co-icon-btn";
  btn.textContent = CALLOUT_ICONS[id];
  btn.addEventListener("click", () => onPick(id));
  return btn;
}

/* ==== 색상 메뉴 ==== */
function buildColorMenu({ anchorEl, block, root, setCalloutColor }) {
  const menu = document.createElement("div");
  menu.className = "callout-menu";
  menu.style.position = "absolute";

  // 위치(앵커 오른쪽 아래)
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
  menu.style.left = `${rect.left + window.scrollX - 8}px`;

  // 섹션: 최근
  const secRecent = document.createElement("div");
  secRecent.className = "co-sec";
  const hRecent = document.createElement("div");
  hRecent.className = "co-sec-title";
  hRecent.innerText = "최근 사용";
  const gRecent = document.createElement("div");
  gRecent.className = "co-grid";
  const recent = loadRecent().slice(0,5);
  if (recent.length === 0) {
    const empty = document.createElement("div");
    empty.className = "co-empty";
    empty.innerText = "최근 사용 없음";
    gRecent.appendChild(empty);
  } else {
    recent.forEach(v => {
      gRecent.appendChild(makeSwatch({
        label: `${v.mode}/${v.color}`,
        mode: v.mode,
        color: v.color,
        onPick: (mode,color) => {
          setCalloutColor(block._index, mode, color);
          // 즉시 UI 반영
          block.meta = { ...(block.meta||{}), callout: { ...(block.meta?.callout||{}), mode, color } };
          applyCalloutStyle(root, block.meta);
          pushRecent(mode, color);
          document.body.removeChild(menu);
        }
      }));
    });
  }
  secRecent.appendChild(hRecent); secRecent.appendChild(gRecent);

  // 섹션: 텍스트 색상
  const secText = document.createElement("div");
  secText.className = "co-sec";
  const hText = document.createElement("div");
  hText.className = "co-sec-title";
  hText.innerText = "텍스트 색상";
  const gText = document.createElement("div");
  gText.className = "co-grid";
  COLORS.forEach(c => gText.appendChild(makeSwatch({
    label: `text/${c}`,
    mode: "text",
    color: c,
    onPick: (mode,color) => {
      setCalloutColor(block._index, mode, color);
      block.meta = { ...(block.meta||{}), callout: { ...(block.meta?.callout||{}), mode, color } };
      applyCalloutStyle(root, block.meta);
      pushRecent(mode, color);
      document.body.removeChild(menu);
    }
  })));
  secText.appendChild(hText); secText.appendChild(gText);

  // 섹션: 배경 색상
  const secBg = document.createElement("div");
  secBg.className = "co-sec";
  const hBg = document.createElement("div");
  hBg.className = "co-sec-title";
  hBg.innerText = "배경 색상";
  const gBg = document.createElement("div");
  gBg.className = "co-grid";
  COLORS.forEach(c => gBg.appendChild(makeSwatch({
    label: `bg/${c}`,
    mode: "bg",
    color: c,
    onPick: (mode,color) => {
      setCalloutColor(block._index, mode, color);
      block.meta = { ...(block.meta||{}), callout: { ...(block.meta?.callout||{}), mode, color } };
      applyCalloutStyle(root, block.meta);
      pushRecent(mode, color);
      document.body.removeChild(menu);
    }
  })));
  secBg.appendChild(hBg); secBg.appendChild(gBg);

  // 조립
  menu.appendChild(secRecent);
  menu.appendChild(document.createElement("hr"));
  menu.appendChild(secText);
  menu.appendChild(document.createElement("hr"));
  menu.appendChild(secBg);

  // 닫기 처리
  const onDocClick = (e) => { if (!menu.contains(e.target) && e.target !== anchorEl) { close(); } };
  const close = () => {
    document.removeEventListener("mousedown", onDocClick);
    if (menu.parentNode) document.body.removeChild(menu);
  };
  setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);

  document.body.appendChild(menu);
}

/* ==== 아이콘 선택창 ==== */
function buildIconPicker({ anchorEl, block, root, iconEl, setCalloutIcon }) {
  const pop = document.createElement("div");
  pop.className = "callout-icon-pop";
  pop.style.position = "absolute";

  const rect = anchorEl.getBoundingClientRect();
  pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
  pop.style.left = `${rect.left + window.scrollX}px`;

  const grid = document.createElement("div");
  grid.className = "co-icon-grid";
  CALLOUT_ICONS.forEach((_, id) => {
    grid.appendChild(makeIconButton(id, (pickedId) => {
      setCalloutIcon(block._index, pickedId);
      // 즉시 UI 반영
      const ch = ICON_ID_TO_CHAR(pickedId);
      iconEl.textContent = ch;
      block.meta = { ...(block.meta||{}), callout: { ...(block.meta?.callout||{}), iconId: pickedId } };
      close();
    }));
  });
  pop.appendChild(grid);

  const onDocClick = (e) => { if (!pop.contains(e.target) && e.target !== anchorEl) { close(); } };
  const close = () => {
    document.removeEventListener("mousedown", onDocClick);
    if (pop.parentNode) document.body.removeChild(pop);
  };
  setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);

  document.body.appendChild(pop);
}





/**
 * 콜아웃 블록 DOM 생성
 * @param {object} params
 *  - block: { bid, type: "callout", content: string }
 *  - index: number
 *  - handlers: {
 *      handleInputChange: (e, index) => void,
 *      handleKeyDown: (e, index) => void,
 *      handleBlur: (index, content) => Promise<void>,
 *      handleFocus: (e, index) => void,
 *      editorRefs: React.useRef / 일반 객체 (bid 키로 엘리먼트 저장),
 *    }
 * @returns {HTMLElement} root 엘리먼트(.block)
 */

export function createCalloutBlock({ block, index, handlers }) {
  const {
    editorRefs,
    handleInputChange, handleKeyDown, handleBlur, handleFocus, 
    setCalloutColor, setCalloutIcon, 
    onCompositionStart, onCompositionEnd, 
  } = handlers || {};

  const meta = block.meta || {};
  block._index = index; // 내부 메뉴 콜백에서 index 접근 용이하게

  const root = document.createElement("div");
  root.className = "block block-callout";
  root.dataset.bid = block.bid;
  applyCalloutStyle(root, meta);

  const wrap = document.createElement("div");
  wrap.className = "callout-wrap";
  root.appendChild(wrap);

  // 아이콘 (클릭 시 아이콘 피커)
  const iconEl = document.createElement("div");
  iconEl.className = "callout-icon";
  iconEl.textContent = getDisplayIcon(meta);
  iconEl.setAttribute("aria-hidden", "false");
  iconEl.title = "아이콘 변경";
  wrap.appendChild(iconEl);

  // 본문
  const editable = document.createElement("div");
  editable.className = "editable";
  editable.contentEditable = "true";
  editable.dataset.bid = block.bid;
  editable.dataset.type = "callout";
  editable.innerText = block.content || "";
  editable.addEventListener('mousedown', (e) => e.stopPropagation());
  editable.addEventListener('click', (e) => e.stopPropagation());
  
  if (typeof onCompositionStart === "function") {
   editable.addEventListener("compositionstart", onCompositionStart);
  }

  if (typeof onCompositionEnd === "function") {
    editable.addEventListener("compositionend", onCompositionEnd);
  }

  if (handleFocus) editable.addEventListener("focus", (e) => handleFocus(e, index));
  if (handleInputChange) editable.addEventListener("input", (e) => handleInputChange(e, index));
  if (handleKeyDown) editable.addEventListener("keydown", (e) => handleKeyDown(e, index));
  if (handleBlur) editable.addEventListener("blur", (e) => handleBlur(index, e.currentTarget.innerText));
  wrap.appendChild(editable);

  // 설정 트리거(…)
  const kebab = document.createElement("button");
  kebab.type = "button";
  kebab.className = "callout-menu-trigger";
  kebab.textContent = "…";
  kebab.title = "색 설정";
  root.appendChild(kebab);

  // 이벤트: 아이콘 클릭 → 아이콘 피커
  iconEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (typeof setCalloutIcon === "function") {
      buildIconPicker({ anchorEl: iconEl, block, root, iconEl, setCalloutIcon });
    }
  });

  // 이벤트: … 클릭 → 색상 메뉴
  kebab.addEventListener("click", (e) => {
    e.stopPropagation();
    if (typeof setCalloutColor === "function") {
      buildColorMenu({ anchorEl: kebab, block, root, setCalloutColor });
    }
  });

  // ref
  if (editorRefs && editorRefs.current) editorRefs.current[block.bid] = editable;
  return root;
}



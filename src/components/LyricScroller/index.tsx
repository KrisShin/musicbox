import React, { useMemo, useRef, useEffect } from "react";

// 定义解析后的歌词行接口
interface LyricLine {
  time: number; // 歌词开始时间 (秒)
  text: string; // 歌词文本
}

// 定义组件 Props
interface LyricScrollerProps {
  lyricText: string; // 完整的 LRC 格式歌词文本
  currentTime: number; // 当前播放时间 (秒)
}

// LRC 歌词解析函数
const parseLyric = (lrcText: string): LyricLine[] => {
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, "0"), 10); // 兼容xx和xxx格式
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = line.replace(timeRegex, "").trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result;
};

const LyricScroller: React.FC<LyricScrollerProps> = ({
  lyricText,
  currentTime,
}) => {
  const lyricContainerRef = useRef<HTMLDivElement>(null);

  // 使用 useMemo 解析歌词，避免不必要的重复解析
  const parsedLyrics = useMemo(() => parseLyric(lyricText), [lyricText]);

  // 找到当前应该高亮的歌词行索引
  const currentLineIndex = parsedLyrics.findIndex((line, index) => {
    const nextLine = parsedLyrics[index + 1];
    return (
      currentTime >= line.time && (!nextLine || currentTime < nextLine.time)
    );
  });

  // 使用 useEffect 实现自动滚动
  useEffect(() => {
    if (currentLineIndex < 0 || !lyricContainerRef.current) return;

    const container = lyricContainerRef.current;
    const activeLineElement = container.children[
      currentLineIndex
    ] as HTMLElement;

    if (activeLineElement) {
      // 计算滚动位置：将高亮行滚动到容器的垂直中心
      const offsetTop = activeLineElement.offsetTop;
      const containerHeight = container.clientHeight;
      const scrollTarget =
        offsetTop - containerHeight / 2 + activeLineElement.clientHeight / 2;

      container.scrollTo({
        top: scrollTarget,
        behavior: "smooth",
      });
    }
  }, [currentLineIndex]);

  return (
    <div
      ref={lyricContainerRef}
      style={{
        height: "30px", // 歌词区域高度，可根据需要调整
        overflowY: "hidden", // 隐藏滚动条
        textAlign: "center",
        color: "#666",
        width: "auto",
      }}
    >
      {parsedLyrics.map((line, index) => (
        <p
          key={index}
          style={{
            margin: 0,
            padding: "4px 0",
            transition: "color 0.3s, font-size 0.3s",
            // 高亮当前行
            color: index === currentLineIndex ? "#e87997" : "#888",
            fontSize: index === currentLineIndex ? "16px" : "14px",
            fontWeight: index === currentLineIndex ? "bold" : "normal",
          }}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
};

export default LyricScroller;

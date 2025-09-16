import React, { useState } from "react";
import { Avatar, Typography } from "antd"; // 1. 移除 Flex 和 Button
import { PlayCircleFilled, PauseCircleFilled, RightOutlined, LeftOutlined } from "@ant-design/icons"; // 2. 使用实心图标，视觉上更突出
import type { Music } from "../../types";
import "./index.css";

const { Text } = Typography;

interface FloatPlayerProps {
  currentMusic: Music | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  visible: boolean;
}

const FloatPlayer: React.FC<FloatPlayerProps> = ({
  currentMusic,
  isPlaying,
  onPlayPause,
  visible,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!currentMusic || !visible) {
    return null;
  }

  // 阻止事件冒泡，避免点击播放器时触发页面其他元素的点击事件
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCollapsed) {
      onPlayPause();
    }
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation(); // 必须阻止冒泡，避免触发播放/暂停
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`floating-player-container ${isCollapsed ? "collapsed" : ""}`}
    >
      {/* 7. 新增的收起/展开切换“把手” */}
      <div className="player-toggle-handle" onClick={handleToggleCollapse}>
        {isCollapsed ? <RightOutlined /> : <LeftOutlined />}
      </div>

      {/* 您的原始封面区域，点击事件已修改 */}
      <div className="cover-section-interactive" onClick={handleClick}>
        <Avatar shape="circle" size={50} src={currentMusic.cover_url} />
        <div className="player-icon-overlay">
          {isPlaying ? (
            <PauseCircleFilled
              style={{ fontSize: "25px", color: "rgba(255, 255, 255, 0.7)" }}
            />
          ) : (
            <PlayCircleFilled
              style={{ fontSize: "25px", color: "rgba(255, 255, 255, 0.7)" }}
            />
          )}
        </div>
      </div>

      {/* 您的原始歌曲信息滚动区域 */}
      <div className="song-info-scroller">
        <Text className="song-info-text">
          {currentMusic.title} - {currentMusic.artist}
        </Text>
      </div>
    </div>
  );
};

export default FloatPlayer;

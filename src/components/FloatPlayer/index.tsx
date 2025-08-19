import React from 'react';
import { Avatar, Typography } from 'antd'; // 1. 移除 Flex 和 Button
import { PlayCircleFilled, PauseCircleFilled } from '@ant-design/icons'; // 2. 使用实心图标，视觉上更突出
import type { Music } from '../../types';
import './index.css';

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
  if (!currentMusic || !visible) {
    return null;
  }

  // 阻止事件冒泡，避免点击播放器时触发页面其他元素的点击事件
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayPause();
  };

  return (
    <div className="floating-player-container">
      {/* 3. [核心改动] 将整个封面区域作为统一的点击目标 */}
      <div className="cover-section-interactive" onClick={handleClick}>
        <Avatar
          shape="circle"
          size={50}
          src={currentMusic.cover_url}
        />
        {/* 覆盖层现在永久可见，作为播放/暂停的视觉指示 */}
        <div className="player-icon-overlay">
          {isPlaying ? (
            <PauseCircleFilled style={{ fontSize: '25px', color: 'rgba(255, 255, 255, 0.7)' }} />
          ) : (
            <PlayCircleFilled style={{ fontSize: '25px', color: 'rgba(255, 255, 255, 0.7)' }} />
          )}
        </div>
      </div>

      {/* 下层：滚动的歌曲信息 (保持不变) */}
      <div className="song-info-scroller">
        <Text className="song-info-text">
          {currentMusic.title} - {currentMusic.artist}
        </Text>
      </div>
    </div>
  );
};

export default FloatPlayer;
import React, { RefObject } from 'react';
import { Typography, Button, Slider, Flex } from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  DownloadOutlined,
  StepForwardOutlined,
  StepBackwardOutlined,
  RetweetOutlined, // 播放模式图标示例
} from '@ant-design/icons';
import { useAppStore } from '../store';
import LyricScroller from '../components/LyricScroller'; // 确保 LyricScroller 组件存在
import './Player.css'; // 我们将为它创建专属的 CSS

const { Title, Text } = Typography;

// 定义组件的 Props 接口
interface PlayerPageProps {
  audioRef: RefObject<HTMLAudioElement>;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const PlayerPage: React.FC<PlayerPageProps> = ({ audioRef }) => {
  // 从 store 获取所有需要的状态和 actions
  const {
    currentMusic,
    isPlaying,
    currentTime,
    duration,
    handlePlayPause,
    handleNext,
    handlePrev,
    handleSave,
  } = useAppStore();

  // [关键] Seek 操作直接在页面内部处理，因为它需要 audioRef
  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = value;
    }
  };

  if (!currentMusic) {
    return (
      <Flex justify="center" align="center" style={{ height: '100%' }}>
        <Text>当前没有播放的歌曲</Text>
      </Flex>
    );
  }

  return (
    <div className="player-page-container">
      {/* 1. 半透明的背景图 */}
      <div
        className="player-bg"
        style={{ backgroundImage: `url(${currentMusic.cover_url})` }}
      />
      <div className="player-bg-overlay" />

      {/* 2. 页面内容容器 */}
      <div className="player-content">
        {/* 歌曲信息 */}
        <Flex vertical align="center" className="song-info">
          <Title level={2} ellipsis style={{ color: '#363636ff', margin: 0 }}>{currentMusic.title}</Title>
          <Text style={{ color: 'rgba(58, 58, 58, 0.8)' }}>{currentMusic.artist}</Text>
        </Flex>

        {/* 歌词滚动器 */}
        <div className="lyric-scroller-wrapper">
          <LyricScroller
            lyricText={currentMusic.lyric || ""}
            currentTime={currentTime}
          />
        </div>

        {/* 进度条 */}
        <Flex vertical style={{ background: '#ffffff55', borderRadius: '8px', padding: '16px 0' }} gap={'large'}>

          <Flex gap="small" align="center" style={{ width: '100%' }}>
            <Text className="time-text">{formatTime(currentTime)}</Text>
            <Slider
              min={0}
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              tooltip={{ formatter: null }} // 禁用默认 tooltip，因为我们有时间显示
              step={0.1}
              style={{ flex: 1 }}
            />
            <Text className="time-text">{formatTime(duration)}</Text>
          </Flex>

          {/* 控制按钮 */}
          <Flex justify="space-around" align="center" className="controls">
            <Button type="text" shape="circle" icon={<RetweetOutlined className="control-icon-secondary" />} />
            <Button type="text" shape="circle" icon={<StepBackwardOutlined className="control-icon" />} onClick={handlePrev} />
            <Button
              type="text"
              shape="circle"
              icon={
                isPlaying ?
                  <PauseCircleFilled className="control-icon-main" /> :
                  <PlayCircleFilled className="control-icon-main" />
              }
              onClick={handlePlayPause}
            />
            <Button type="text" shape="circle" icon={<StepForwardOutlined className="control-icon" />} onClick={handleNext} />
            <Button type="text" shape="circle" icon={<DownloadOutlined className="control-icon-secondary" />} onClick={handleSave} />
          </Flex>
        </Flex>

      </div>
    </div>
  );
};

export default PlayerPage;
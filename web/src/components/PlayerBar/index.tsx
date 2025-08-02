import React from "react";
import { Layout, Row, Col, Typography, Button, Slider, Flex } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { Song } from "../../types";
import LyricScroller from "../LyricScroller";

const { Footer } = Layout;
const { Text } = Typography;

// 定义组件的 Props 接口
interface PlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyricText: string; // 新增：传递歌词文本
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (value: number) => void;
}
const formatTime = (timeInSeconds: number): string => {
  const S = Math.floor(timeInSeconds);
  const m = Math.floor(S / 60);
  const s = S % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const PlayerBar: React.FC<PlayerBarProps> = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  lyricText,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
}) => {
  // 如果没有当前歌曲，不显示播放栏
  if (!currentSong) {
    return null;
  }

  const formatter = (value?: number): string => {
    if (typeof value !== "number") return "";
    const time = (value / 100) * duration;
    return formatTime(time);
  };

  return (
    <Footer
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        backgroundColor: "#ffede5ff",
        borderRadius: "15px 15px 0 0",
        padding: "8px 14px",
        borderTop: "5px solid #ffb5b5ff",
        zIndex: 1000,
      }}
    >
      <Row align="middle" justify="space-between">
        {/* 歌曲信息 */}
        <Col span={6}>
          <Text strong ellipsis style={{ fontSize: "16px" }}>
            {currentSong.title}
          </Text>
          <br />
          <Text type="secondary" ellipsis>
            {currentSong.artist}
          </Text>
        </Col>
        {/* 播放控制 */}
        <Col span={18} style={{ textAlign: "center" }}>
          <Row>
            <Button
              type="text"
              shape="circle"
              icon={<StepBackwardOutlined />}
              onClick={onPrev}
            />
            <Button
              type="primary"
              shape="circle"
              icon={
                isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
              }
              onClick={onPlayPause}
              style={{ margin: "0 3px", transform: "scale(1.05)" }}
            />
            <Button
              type="text"
              shape="circle"
              icon={<StepForwardOutlined />}
              onClick={onNext}
            />
            <Flex align="center" gap="small" style={{ flex: 1 }}>
              <Text style={{ fontSize: "12px", color: "#888" }}>
                {formatTime(currentTime)}
              </Text>
              <Slider
                value={(currentTime / duration) * 100}
                onChange={onSeek}
                tooltip={{ formatter }}
                step={0.1}
                style={{ flex: 1, margin: "0 8px" }} // 关键：让 Slider 占据剩余空间
              />
              <Text style={{ fontSize: "12px", color: "#888" }}>
                {formatTime(duration)}
              </Text>
            </Flex>
            <Button
              type="text"
              icon={<DownloadOutlined style={{ color: "#e87997" }} />}
              //   onClick={() => handleDownload(item)}
            />
          </Row>
          <Row
            justify="center"
            style={{ marginTop: "4px", border: "1px 0 1px 0 solid #ffb5b5ff" }}
          >
            <LyricScroller lyricText={lyricText} currentTime={currentTime} />
          </Row>
        </Col>
      </Row>
    </Footer>
  );
};

export default PlayerBar;

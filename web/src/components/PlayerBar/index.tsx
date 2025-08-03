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
        <Col span={24}>
          <Row justify="center" style={{ marginBottom: "3px" }}>
            <Text
              strong
              ellipsis
              style={{ maxWidth: "30%", alignContent: "center" }}
            >
              {currentSong.title} - {currentSong.artist}
              1231231212312312312312
            </Text>
            <Flex
              flex={1}
              style={{ minWidth: "70%", borderBottom: "1px solid #ffb5b5ff" }}
            >
              <LyricScroller lyricText={lyricText} currentTime={currentTime} />
            </Flex>
          </Row>
          <Row>
            <Flex flex={1} gap={"small"}>
              <Button
                type="text"
                shape="circle"
                icon={<StepBackwardOutlined />}
                onClick={onPrev}
                color="pink"
                variant="outlined"
              />
              <Button
                type="primary"
                shape="circle"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                onClick={onPlayPause}
                style={{ margin: "0 5px", transform: "scale(1.05)" }}
              />
              <Button
                type="text"
                shape="circle"
                icon={<StepForwardOutlined />}
                onClick={onNext}
                color="pink"
                variant="outlined"
              />
              <Flex align="center" gap="small" flex={1}>
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
            </Flex>
          </Row>
        </Col>
      </Row>
    </Footer>
  );
};

export default PlayerBar;

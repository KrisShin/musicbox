import React, { RefObject, useEffect, useState } from "react";
import { Layout, Row, Col, Typography, Button, Slider, Flex } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  DownloadOutlined,
  CloseOutlined,
  StepForwardOutlined,
  StepBackwardOutlined,
} from "@ant-design/icons";
import type { Music } from "../../types";
import LyricScroller from "../LyricScroller";

const { Footer } = Layout;
const { Text } = Typography;

// 定义组件的 Props 接口
interface PlayerBarProps {
  audioRef: RefObject<HTMLAudioElement>; // 接收 audioRef
  currentMusic: Music | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSave: () => void;
}
const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const PlayerBar: React.FC<PlayerBarProps> = ({
  audioRef,
  currentMusic,
  isPlaying,
  onPlayPause,
  onSave,
  onPrev,
  onNext,
  onClose,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // [关键] 副作用监听器，只在 PlayerBar 内部生效
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);

    // 监听原生 audio 事件
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    // loadedmetadata 也可以在这里监听来首次设置 duration
    audio.addEventListener("loadedmetadata", handleDurationChange);

    return () => {
      // 组件卸载时清理监听器
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadedmetadata", handleDurationChange);
    };
  }, [audioRef]); // 依赖 audioRef

  // 如果没有当前歌曲，不显示播放栏
  if (!currentMusic) {
    return null;
  }

  const formatter = (value?: number): string => {
    if (typeof value !== "number") return "";
    const time =
      (value / 100) *
      (typeof currentMusic.duration === "number" ? currentMusic.duration : 0);
    return formatTime(time);
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (audio && duration > 0) {
      audio.currentTime = value;
      setCurrentTime(value); // 立即更新UI，避免延迟感
    }
  };

  return (
    <Footer
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        backgroundColor: "#ffede5ff",
        borderRadius: "15px 15px 0 0",
        padding: "8px 14px 28px 14px",
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
              {currentMusic.title} - {currentMusic.artist}
            </Text>
            <Flex
              flex={1}
              style={{ minWidth: "70%", borderBottom: "1px solid #ffb5b5ff" }}
            >
              <LyricScroller
                lyricText={currentMusic.lyric || ""}
                currentTime={currentTime}
              />
            </Flex>
            <Button
              style={{
                position: "absolute",
                right: "-10px",
                top: "-12px",
              }}
              type="text"
              icon={<CloseOutlined style={{ color: "#f00" }} />}
              onClick={onClose}
            />
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
                  value={
                    (currentTime /
                      (typeof currentMusic.duration === "number"
                        ? currentMusic.duration
                        : 1)) *
                    100
                  }
                  onChange={handleSeek}
                  tooltip={{ formatter }}
                  step={0.1}
                  style={{ flex: 1, margin: "0 8px" }} // 关键：让 Slider 占据剩余空间
                />
                <Text style={{ fontSize: "12px", color: "#888" }}>
                  {formatTime(
                    typeof currentMusic.duration === "number"
                      ? currentMusic.duration
                      : 0
                  )}
                </Text>
              </Flex>
              <a color="pink" style={{ padding: "5px" }} onClick={onSave}>
                <DownloadOutlined style={{ color: "#e87997" }} />
              </a>
            </Flex>
          </Row>
        </Col>
      </Row>
    </Footer>
  );
};

export default PlayerBar;

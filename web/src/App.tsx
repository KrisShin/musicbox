import React, { useState, useRef, useEffect } from "react";
import {
  Layout,
  Input,
  List,
  Typography,
  Spin,
  Empty,
  Button,
  Image,
  Row,
  Col,
  Flex,
  App as AntdApp,
} from "antd";
import { DownloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import PlayerBar from "./components/PlayerBar";
import type { Song, SearchResult } from "./types";

const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

const LYRIC = `[00:00.0]晴天 - 周杰伦 (Jay Chou)
[00:02.25]词：周杰伦
[00:04.5]曲：周杰伦
[00:06.75]编曲：周杰伦
[00:09.0]制作人：周杰伦
[00:11.25]合声：周杰伦
[00:13.5]合声编写：周杰伦
[00:15.75]吉他：蔡科俊Again
[00:18.0]贝斯：陈任佑
[00:20.25]鼓：陈柏州
[00:22.51]录音助理：刘勇志
[00:24.76]录音工程：杨瑞代（Alfa Studio）
[00:27.01]混音工程：杨大纬（杨大纬录音工作室）
[00:29.26]故事的小黄花
[00:32.71]从出生那年就飘着
[00:36.24]童年的荡秋千
[00:39.75]随记忆一直晃到现在
[00:42.91]Re So So Si Do Si La
[00:45.93]So La Si Si Si Si La Si La So
[00:49.87]吹着前奏望着天空
[00:53.2]我想起花瓣试着掉落
[00:56.72]为你翘课的那一天
[00:58.83]花落的那一天
[01:00.6]教室的那一间
[01:02.32]我怎么看不见
[01:04.12]消失的下雨天
[01:05.81]我好想再淋一遍
[01:09.99]没想到失去的勇气我还留着
[01:16.12]好想再问一遍
[01:17.97]你会等待还是离开
[01:24.91]刮风这天我试过握着你手
[01:30.45]但偏偏雨渐渐大到我看你不见
[01:38.880005]还要多久我才能在你身边
[01:45.44]等到放晴的那天也许我会比较好一点
[01:52.869995]从前从前有个人爱你很久
[01:58.54]但偏偏风渐渐把距离吹得好远
[02:06.94]好不容易又能再多爱一天
[02:13.5]但故事的最后你好像还是说了拜拜
[02:34.9]为你翘课的那一天
[02:36.88]花落的那一天
[02:38.66]教室的那一间
[02:40.39]我怎么看不见
[02:42.15]消失的下雨天
[02:43.87]我好想再淋一遍
[02:48.0]没想到失去的勇气我还留着
[02:54.15]好想再问一遍
[02:56.03]你会等待还是离开
[03:02.92]刮风这天我试过握着你手
[03:08.49]但偏偏雨渐渐大到我看你不见
[03:16.94]还要多久我才能在你身边
[03:23.43]等到放晴的那天也许我会比较好一点
[03:30.87]从前从前有个人爱你很久
[03:37.14]偏偏风渐渐把距离吹得好远
[03:44.88]好不容易又能再多爱一天
[03:51.42]但故事的最后你好像还是说了拜拜
[03:58.49]刮风这天我试过握着你手
[04:01.97]但偏偏雨渐渐大到我看你不见
[04:05.65]还要多久我才能够在你身边
[04:09.07]等到放晴那天也许我会比较好一点
[04:12.92]从前从前有个人爱你很久
[04:15.91]但偏偏雨渐渐把距离吹得好远
[04:19.38]好不容易又能再多爱一天
[04:22.86]但故事的最后你好像还是说了拜`;
// 模拟的搜索结果数据，用于UI开发
const MOCK_SONGS: Song[] = [
  { id: "1", title: "晴天", artist: "周杰伦", url: "...", duration: 240 },
  { id: "2", title: "七里香", artist: "周杰伦", url: "...", duration: 258 },
  { id: "3", title: "稻香", artist: "周杰伦", url: "...", duration: 292 },
  { id: "1", title: "晴天", artist: "周杰伦", url: "...", duration: 240 },
  { id: "2", title: "七里香", artist: "周杰伦", url: "...", duration: 258 },
  { id: "3", title: "稻香", artist: "周杰伦", url: "...", duration: 292 },
  { id: "1", title: "晴天", artist: "周杰伦", url: "...", duration: 240 },
  { id: "2", title: "七里香", artist: "周杰伦", url: "...", duration: 258 },
  { id: "3", title: "稻香", artist: "周杰伦", url: "...", duration: 292 },
  { id: "1", title: "晴天", artist: "周杰伦", url: "...", duration: 240 },
  { id: "2", title: "七里香", artist: "周杰伦", url: "...", duration: 258 },
  { id: "3", title: "稻香", artist: "周杰伦", url: "...", duration: 292 },
];

function App() {
  const { message } = AntdApp.useApp();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);

  // 播放器状态
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 搜索处理
  const handleSearch = async (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;

    setLoading(true);
    setSearched(true);
    // TODO: 调用 FastAPI 后端 /search 接口
    console.log(`Searching for: ${keyword}`);
    // 模拟网络延迟
    setTimeout(() => {
      setSongs(MOCK_SONGS);
      setLoading(false);
    }, 1000);
  };

  // 下载处理
  const handleDownload = async (song: Song) => {
    message.info(`准备下载: ${song.title}`);
    // TODO: 调用 FastAPI 后端 /download-url 接口，然后发起下载
    console.log(`Downloading: ${song.id}`);
  };

  // --- 播放逻辑 ---
  const handlePlay = (song: Song) => {
    if (currentSong?.id === song.id) {
      // 如果是同一首歌，切换播放/暂停
      handlePlayPause();
    } else {
      // 播放新歌曲
      setCurrentSong(song);
      setIsPlaying(true);
      // 注意：在真实应用中，url 需要从后端获取
      // audioRef.current.src = song.url;
      // audioRef.current.play();
      message.success(`开始播放: ${song.title}`);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => console.log("Next song");
  const handlePrev = () => console.log("Previous song");
  const handleSeek = (value: number) => {
    const duration = audioRef.current?.duration || 0;
    if (audioRef.current)
      audioRef.current.currentTime = (value / 100) * duration;
  };

  // 使用 useEffect 监听 audio 元素的事件来更新进度
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    console.log(audio)

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  return (
    <Layout style={{ minHeight: "100vh", backgroundColor: "#fcf0f0ff" }}>
      <div
        style={{
          position: "sticky", // 1. 将 Header 设置为粘性定位
          top: 0, // 2. 粘在顶部
          zIndex: 10, // 3. 确保它在最上层
        }}
      >
        <Header
          style={{
            // 1. 设置浅粉色背景和底部边框
            backgroundColor: "#fff5f5",
            borderBottom: "1px solid #ffb5b5ff",
            display: "flex",
            justifyContent: "center",
            padding: `env(safe-area-inset-top) 16px 4px 16px`,
            height: `calc(66px + env(safe-area-inset-top))`,
          }}
        >
          <Flex align="end" gap={1}>
            <Image
              src="/src/assets/icon.png"
              preview={false}
              width={25}
              height={25}
              style={{ display: "flex" }}
            />
            <Title
              level={3}
              style={{
                margin: 0,
                color: "#333333",
                lineHeight: 1, // 确保标题行高不会增加额外空间
              }}
            >
              MusicBox
            </Title>
          </Flex>
        </Header>
        <div style={{ padding: "5px" }}>
          <Search
            placeholder="输入歌曲名、歌手..."
            enterButton="搜索"
            size="large"
            onSearch={handleSearch}
            loading={loading}
          />
        </div>
      </div>

      <Content className="content-padding-bottom" style={{ padding: "4px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <div>
            <Spin spinning={loading} tip="正在玩命搜索中...">
              {songs.length > 0 ? (
                <List
                  style={{
                    padding: "14px",
                  }}
                  dataSource={songs}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(item)}
                        />,
                        // <Button
                        //   color="red"
                        //   type="dashed"
                        //   icon={<PlayCircleOutlined color="red" />}
                        //   onClick={() => handlePlay(item)}
                        // />,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <a onClick={() => handlePlay(item)}>{item.title}</a>
                        }
                        description={`歌手: ${item.artist}`}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                searched && (
                  <Empty description="未能找到相关歌曲，换个关键词试试？" />
                )
              )}
            </Spin>
          </div>
        </div>
      </Content>

      {/* 播放器和隐藏的 audio 标签 */}
      <PlayerBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        lyricText={LYRIC}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
      />
      <audio ref={audioRef} style={{ display: "none" }} />
    </Layout>
  );
}

export default App;

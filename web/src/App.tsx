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
  Flex,
  App as AntdApp,
} from "antd";
import { DownloadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import PlayerBar from "./components/PlayerBar";
import type { Song, SearchResult } from "./types";
import { getMusicDetailsApi, searchMusicApi } from "./api";

const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

function App() {
  const { message } = AntdApp.useApp();

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [searched, setSearched] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState(false);

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
    let currentPage = 0;
    if (keyword != currentKeyword) {
      setCurrentKeyword(keyword); // 保存当前关键词
    } else {
      currentPage = page + 1;
    }

    try {
      // 调用我们封装好的 API 函数
      const result = await searchMusicApi(keyword, currentPage);
      keyword == currentKeyword
        ? setSongs(songs.concat(result.songs))
        : setSongs(result.songs);
      setHasMore(result.has_more); // 如果需要加载更多
      setPage(currentPage);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 下载处理
  const handleDetail = async (song: Song) => {
    // message.info(`准备下载: ${song.title}`);
    if (!song.url) return;
    const result = await getMusicDetailsApi({ url: song.url });
    setCurrentSong({ ...song, ...result });
    handlePlay(song)
  };

  // --- 播放逻辑 ---
  const handlePlay = (song: Song) => {
    if (currentSong?.song_id === song.song_id) {
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
  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = ""; // 清空资源，防止继续在后台加载
    }
    setIsPlaying(false);
    setCurrentSong(null);
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
    console.log(audio);

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
            paddingBottom: currentSong ? "90px" : "24px",
            transition: "padding-bottom 0.3s ease-in-out", // 增加一个平滑的过渡效果
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
                          icon={<PlayCircleOutlined />}
                          onClick={() => handleDetail(item)}
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <a onClick={() => handlePlay(item)}>{item.title}</a>
                        }
                        description={`${item.artist}`}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                searched && (
                  <Empty description="未能找到相关歌曲，换个关键词试试？" />
                )
              )}
              {hasMore && (
                <Flex justify="center">
                  <Button
                    type="primary"
                    onClick={() => handleSearch(currentKeyword)}
                  >
                    加载更多
                  </Button>
                </Flex>
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
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onClose={handleClose}
      />
      <audio ref={audioRef} style={{ display: "none" }} />
    </Layout>
  );
}

export default App;

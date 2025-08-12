import { useState, useRef, useEffect } from "react";
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
  message,
} from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import PlayerBar from "./components/PlayerBar";
import type { Muisc } from "./types";
import { searchMusic, musicDetail } from "./crawler";
import { downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import "./App.css";

const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

function App() {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [searched, setSearched] = useState(false);
  const [songs, setSongs] = useState<Muisc[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState(false);
  const [playingMusicIndex, setPlayingMusicIndex] = useState(-1);

  // 播放器状态
  const [currentSong, setCurrentSong] = useState<Muisc | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 搜索处理
  const handleSearch = async (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;

    setLoading(true);
    setSearched(true);
    let currentPage = 1;
    if (keyword != currentKeyword) {
      setCurrentKeyword(keyword); // 保存当前关键词
    } else {
      currentPage = page + 1;
    }

    try {
      // 调用我们封装好的 API 函数
      const result = await searchMusic(keyword, currentPage);
      if (result.songs.length === 0) {
        message.warning("未找到相关歌曲，请尝试其他关键词");
        setHasMore(false)
        return
      }
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
  const handleDetail = async (song: Muisc, index: number) => {
    setPlayingMusicIndex(index);
    message.info(`获取信息中: ${song.title}, 请稍候`);
    if (!song.url) return;
    const result = await musicDetail(song);
    setCurrentSong(result);
    handlePlay(result);

    if (audioRef.current && result.play_url) {
      audioRef.current.src = result.play_url;
      audioRef.current.play();
    }
    message.destroy("play");
  };

  // --- 播放逻辑 ---
  const handlePlay = (song: Muisc) => {
    if (currentSong?.song_id === song.song_id) {
      // 如果是同一首歌，切换播放/暂停
      handlePlayPause();
    } else {
      // 播放新歌曲
      setCurrentSong(song);

      // 注意：在真实应用中，url 需要从后端获取
      if (audioRef.current && song.play_url) {
        audioRef.current.src = song.url;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.error("播放失败:", e));
      }
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
  const _playIndexMuisc = (index: number) => {
    if (index < 0 || index >= songs.length) {
      setPlayingMusicIndex(-1);
      handleClose();
      return;
    }
    const song = songs[index];
    setPlayingMusicIndex(index);
    handleDetail(song, index);
  };

  const handleNext = () => _playIndexMuisc(playingMusicIndex + 1);
  const handlePrev = () => _playIndexMuisc(playingMusicIndex - 1);
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

  const handleSave = async () => {
    const song = currentSong;
    const messageKey = `download-${song?.song_id}`;
    message.loading({
      content: `《${song?.title}》: 解析链接...`,
      key: messageKey,
      duration: 0,
    });

    try {
      if (!song?.play_url) throw new Error("未能获取下载链接");

      message.loading({
        content: `《${song.title}》: 选择保存位置...`,
        key: messageKey,
        duration: 0,
      });

      const suggestedFilename = `${song.title} - ${song.artist}.mp3`;
      const defaultPath = await downloadDir();
      const filePath = await save({
        title: "选择保存位置",
        defaultPath: `${defaultPath}/${suggestedFilename}`,
        filters: [{ name: "MP3 Audio", extensions: ["mp3"] }],
      });

      if (!filePath) {
        message.destroy(messageKey);
        // setDownloadingId(null);
        return;
      }

      message.loading({
        content: `《${song.title}》: 下载中...`,
        key: messageKey,
        duration: 0,
      });

      // --- 最终的、结合了所有知识的请求 ---
      const response = await tauriFetch(song.play_url, {
        method: "GET",
        headers: {
          // 伪造一个合法的来源页面，这是通过服务器校验的关键
          Referer: `https://www.gequhai.net${song.url}`,
        },
      });
      // ---

      if (!response.ok) {
        throw new Error(`下载请求失败，状态: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await writeFile(filePath, uint8Array);

      message.success({
        content: `《${song.title}》已成功保存！`,
        key: messageKey,
        duration: 3,
      });
      // await open(filePath.substring(0, filePath.lastIndexOf("/")));
    } catch (error: any) {
      message.error({
        content: `下载失败: ${error.message || "未知错误"}`,
        key: messageKey,
        duration: 5,
      });
    } finally {
      // setDownloadingId(null);
    }
  };

  // 使用 useEffect 监听 audio 元素的事件来更新进度
  // --- 3. 使用 useEffect 来处理所有 audio 元素的副作用 ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 当 src 改变，音频开始加载，元数据加载完毕后会触发此事件
    const handleMetadataLoaded = () => {
      // 此时 audio.duration 就有值了
      currentSong && setCurrentSong({ ...currentSong, duration: audio.duration });
      // 元数据加载完后，再开始播放
      audio.play();
      setIsPlaying(true);
    };

    // 监听播放进度
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    // 监听播放结束
    const handleEnded = () => {
      setIsPlaying(false);
      // (可选) 在这里可以实现自动播放下一首的逻辑
    };

    // 添加事件监听
    audio.addEventListener("loadedmetadata", handleMetadataLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    // 组件卸载或 currentSong 改变时，清理上一次的监听器
    return () => {
      audio.removeEventListener("loadedmetadata", handleMetadataLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentSong]); // 依赖 currentSong，当歌曲切换时，重新设置监听

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
            height: `calc(75px + env(safe-area-inset-top))`,
          }}
        >
          <Flex align="end" gap={1}>
            <Image
              src="/header_icon.png"
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

      <Content className="content-padding-bottom" style={{ padding: "6px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            maxWidth: "800px",
            margin: "0 auto",
            paddingBottom: currentSong ? "110px" : "24px",
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
                  renderItem={(item, index) => (
                    <List.Item
                      actions={[
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          onClick={() => handleDetail(item, index)}
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Text>{item.title}</Text>}
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
        onSave={handleSave}
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

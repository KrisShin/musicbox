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
import { PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import PlayerBar from "./components/PlayerBar";
import type { Muisc } from "./types";
import { searchMusic, musicDetail } from "./crawler";
import { downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import "./App.css";
import { primaryThemeColor } from "./main";
const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;
function App() {
  const [loading, setLoading] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState("热门");
  const [searched, setSearched] = useState(false);
  const [musicList, setMusicList] = useState<Muisc[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState(false);
  const [playingMusicIndex, setPlayingMusicIndex] = useState(-1);
  const [currentMusic, setCurrentMusic] = useState<Muisc | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const handleSearch = async (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;
    setLoading(true);
    setSearched(true);
    let currentPage = 1;
    if (keyword != currentKeyword) {
      setCurrentKeyword(keyword);
    } else {
      currentPage = page + 1;
    }
    try {
      const result = await searchMusic(keyword, currentPage);
      if (result.music_list.length === 0) {
        message.warning("未找到相关歌曲，请尝试其他关键词");
        setHasMore(false)
        return
      }
      keyword == currentKeyword
        ? setMusicList(musicList.concat(result.music_list))
        : setMusicList(result.music_list);
      setHasMore(result.has_more);
      setPage(currentPage);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleDetail = async (music: Muisc, index: number) => {
    setPlayingMusicIndex(index);
    message.info(`获取信息中: ${music.title}, 请稍候`);
    if (!music.url) return;
    const result = await musicDetail(music);
    setCurrentMusic(result);
    handlePlay(result);
    if (audioRef.current && result.play_url) {
      audioRef.current.src = result.play_url;
      audioRef.current.play();
    }
    message.destroy("play");
  };
  const handlePlay = (music: Muisc) => {
    if (currentMusic?.song_id === music.song_id) {
      handlePlayPause();
    } else {
      setCurrentMusic(music);
      if (audioRef.current && music.play_url) {
        audioRef.current.src = music.url;
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.error("播放失败:", e));
      }
      message.success(`开始播放: ${music.title}`);
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
    if (index < 0 || index >= musicList.length) {
      setPlayingMusicIndex(-1);
      handleClose();
      return;
    }
    const music = musicList[index];
    setPlayingMusicIndex(index);
    handleDetail(music, index);
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
      audioRef.current.src = "";
    }
    setIsPlaying(false);
    setCurrentMusic(null);
  };
  const handleSave = async () => {
    const music = currentMusic;
    const messageKey = `download-${music?.song_id}`;
    message.loading({
      content: `《${music?.title}》: 解析链接...`,
      key: messageKey,
      duration: 0,
    });
    try {
      if (!music?.play_url) throw new Error("未能获取下载链接");
      message.loading({
        content: `《${music.title}》: 选择保存位置...`,
        key: messageKey,
        duration: 0,
      });
      const suggestedFilename = `${music.title} - ${music.artist}.mp3`;
      const defaultPath = await downloadDir();
      const filePath = await save({
        title: "选择保存位置",
        defaultPath: `${defaultPath}/${suggestedFilename}`,
        filters: [{ name: "MP3 Audio", extensions: ["mp3"] }],
      });
      if (!filePath) {
        message.destroy(messageKey);
        return;
      }
      message.loading({
        content: `《${music.title}》: 下载中...`,
        key: messageKey,
        duration: 0,
      });
      const response = await tauriFetch(music.play_url, {
        method: "GET",
        headers: {
          Referer: `https://www.gequhai.net${music.url}`,
        },
      });
      if (!response.ok) {
        throw new Error(`下载请求失败，状态: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await writeFile(filePath, uint8Array);
      message.success({
        content: `《${music.title}》已成功保存！`,
        key: messageKey,
        duration: 3,
      });
    } catch (error: any) {
      message.error({
        content: `下载失败: ${error.message || "未知错误"}`,
        key: messageKey,
        duration: 5,
      });
    } finally {
    }
  };

  const handleAdd2Playlist = async (music: Muisc) => { }
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleMetadataLoaded = () => {
      currentMusic && setCurrentMusic({ ...currentMusic, duration: audio.duration });
      audio.play();
      setIsPlaying(true);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
    };
    audio.addEventListener("loadedmetadata", handleMetadataLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", handleMetadataLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentMusic]);
  useEffect(() => {
    // handleSearch('热门');
  }, [])
  return (
    <Layout style={{ minHeight: "100vh", backgroundColor: "#fcf0f0ff" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Header
          style={{
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
                lineHeight: 1,
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
            paddingBottom: currentMusic ? "110px" : "24px",
            transition: "padding-bottom 0.3s ease-in-out",
          }}
        >
          <div>
            <Spin spinning={loading} tip="正在玩命搜索中...">
              {musicList.length > 0 ? (
                <List
                  style={{
                    padding: "14px",
                  }}
                  dataSource={musicList}
                  renderItem={(item, index) => (
                    <List.Item
                      actions={[
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          onClick={() => handleDetail(item, index)}
                        />,
                        <Button
                          type="text"
                          icon={<PlusOutlined style={{ color: primaryThemeColor }} />}
                          onClick={() => handleAdd2Playlist(item)}
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
        currentMusic={currentMusic}
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

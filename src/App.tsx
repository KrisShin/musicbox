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
  Popover,
} from "antd";
import {
  CheckOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import PlayerBar from "./components/PlayerBar";
import type { Music, PlaylistInfo } from "./types";
import { searchMusic, musicDetail } from "./crawler";
import { downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import "./App.css";
import { primaryThemeColor } from "./main";
import { invoke } from "@tauri-apps/api/core";
const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

function App() {
  const [loading, setLoading] = useState(false);
  const [currentKeyword, setCurrentKeyword] = useState("热门");
  const [searched, setSearched] = useState(false);
  const [musicList, setMusicList] = useState<Music[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState(false);
  const [playingMusicIndex, setPlayingMusicIndex] = useState(-1);
  const [currentMusic, setCurrentMusic] = useState<Music | null>(null);
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
        setHasMore(false);
        return;
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
  const handleDetail = async (music: Music, index: number) => {
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
  const handlePlay = (music: Music) => {
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

  const handleAdd2Playlist = async (music: Music, playlistId: number) => {
    try {
      const payload = {
        playlistId: playlistId,
        songIds: [music.song_id], // 我们的后端接口接收的是一个数组
      };

      await invoke("toggle_music_in_playlist", { payload });

      // 给予用户即时反馈
      message.success(`“${music.title}” 操作成功!`);
    } catch (error) {
      console.error(
        `操作歌曲 ${music.title} 到歌单 ${playlistId} 失败:`,
        error
      );
      message.error("操作失败，请稍后再试");
    }
  };

  const AddToPlaylistButton = ({
    song,
    primaryThemeColor,
  }: {
    song: Music;
    primaryThemeColor: string;
  }) => {
    // --- State ---
    const [open, setOpen] = useState(false); // 控制 Popover 的显示与隐藏
    const [loading, setLoading] = useState(false); // 控制加载状态
    const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]); // 存储歌单列表

    // --- Functions ---

    // Popover 显示状态改变时的回调
    const handleOpenChange = async (newOpen: boolean) => {
      setOpen(newOpen);
      // 只有在准备打开 Popover 且列表为空时才去获取数据
      if (newOpen && playlists.length === 0) {
        setLoading(true);
        try {
          // 调用我们强大的后端接口，传入 song_id 来获取 is_in 状态
          const result: PlaylistInfo[] = await invoke("get_all_playlists", {
            songId: song.song_id,
          });
          setPlaylists(result);
        } catch (error) {
          console.error("获取歌单列表失败:", error);
          message.error("无法加载歌单列表");
          setOpen(false); // 加载失败时关闭 Popover
        } finally {
          setLoading(false);
        }
      }
    };

    // 点击某个歌单项时的处理函数
    const onPlaylistClick = (playlist: PlaylistInfo) => {
      // 调用我们之前定义的通用函数
      handleAdd2Playlist(song, playlist.id);
      // 操作后立即关闭 Popover
      setOpen(false);
    };

    // --- Render ---

    // 这是 Popover 内部要渲染的内容
    const playlistContent = (
      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <Spin />
          </div>
        ) : (
          <List
            dataSource={playlists}
            renderItem={(playlist) => (
              <List.Item
                onClick={() => onPlaylistClick(playlist)}
                style={{ cursor: "pointer" }}
                actions={[
                  // 如果歌曲已在歌单中，显示一个√
                  playlist.is_in && (
                    <CheckOutlined style={{ color: primaryThemeColor }} />
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Text style={{ fontSize: "14px" }}>{playlist.name}</Text>
                  }
                  description={`${playlist.song_count} 首`}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    );

    return (
      <Popover
        content={playlistContent}
        title="添加到歌单"
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="left" // 让菜单在左侧弹出
      >
        <Button
          type="text"
          icon={<PlusOutlined style={{ color: primaryThemeColor }} />}
        />
      </Popover>
    );
  };
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleMetadataLoaded = () => {
      currentMusic &&
        setCurrentMusic({ ...currentMusic, duration: audio.duration });
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
  }, []);
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
                        <AddToPlaylistButton
                          song={item}
                          primaryThemeColor={primaryThemeColor} // 将主题色传入
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

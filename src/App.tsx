import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
// 1. 引入 Col 和 Row 用于响应式布局
import {
  Layout,
  Input,
  List,
  Modal,
  Typography,
  Spin,
  Empty,
  Button,
  message,
  Col,
  Row,
} from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'; 
import "antd/dist/reset.css";
import useMediaQuery from "./useMediaQuery"; // 2. 引入自定义hook

const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

interface Song {
  id: string;
  title: string;
  artist: string;
}

interface SearchResult {
  songs: Song[];
  has_more: boolean;
}

function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null); // 记录正在播放/加载的歌曲ID
  const [currentSong, setCurrentSong] = useState<Song | null>(null); // 当前播放的歌曲信息
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null); // 引用audio元素

  useEffect(() => {
    if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().then(() => setIsPlaying(true));
    }
  }, [audioUrl]);

  // 3. 使用hook判断是否为移动端视图
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleSearch = async (value: string) => {
    // ... (函数内容保持不变)
    const keyword = value.trim();
    if (!keyword) return;
    setLoading(true);
    setSearched(true);
    setCurrentKeyword(keyword);
    try {
      const result = await invoke<SearchResult>("search_music", {
        keyword,
        page: 1,
      });
      setSongs(result.songs);
      setHasMore(result.has_more);
      setCurrentPage(1);
    } catch (error) {
      console.error("搜索失败:", error);
      message.error(`搜索失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    // ... (函数内容保持不变)
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const result = await invoke<SearchResult>("search_music", {
        keyword: currentKeyword,
        page: nextPage,
      });
      setSongs((prevSongs) => [...prevSongs, ...result.songs]);
      setHasMore(result.has_more);
      setCurrentPage(nextPage);
    } catch (error) {
      console.error("加载更多失败:", error);
      message.error(`加载更多失败: ${error}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDownload = async (song: Song) => {
    setDownloadingId(song.id);
    message.loading({
      content: `正在解析《${song.title}》的下载链接...`,
      key: "download",
      duration: 0,
    });

    try {
      await invoke("download_song", {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        keyword: currentKeyword,
      });
      message.success({
        content: `《${song.title}》已成功保存！`,
        key: "download",
        duration: 3,
      });
    } catch (error: any) {
      // --- 核心改动开始 ---
      const errorStr = String(error);

      // 判断是否是我们自定义的失效链接错误
      if (errorStr.includes("链接已失效或超时")) {
        const url = errorStr.split(":").slice(1).join(":"); // 提取URL
        message.destroy("download"); // 销毁加载提示

        Modal.error({
          title: "下载失败",
          content: (
            <div>
              <p>服务器返回的不是有效的音乐文件，链接可能已超时。</p>
              <p>您可以点击下面的链接，在浏览器中尝试下载：</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ wordBreak: "break-all" }}
              >
                {url}
              </a>
            </div>
          ),
          okText: "知道了",
        });
      } else if (error !== "用户取消了下载或路径无效") {
        message.error({
          content: `下载失败: ${error}`,
          key: "download",
          duration: 3,
        });
      } else {
        message.destroy("download");
      }
      // --- 核心改动结束 ---
      console.error("下载失败:", error);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePlay = async (song: Song) => {
    if (currentSong?.id === song.id) {
        // 如果点击的是当前正在播放的歌曲，则切换播放/暂停
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            audioRef.current?.play();
            setIsPlaying(true);
        }
        return;
    }

    setPlayingId(song.id);
    setCurrentSong(song);
    setIsPlaying(false);
    message.loading({ content: `正在加载《${song.title}》...`, key: 'play' });
    try {
        const url = await invoke<string>('get_play_url', {
            songId: song.id,
            title: song.title,
            artist: song.artist,
            keyword: currentKeyword,
        });
        setAudioUrl(url);
        message.success({ content: '加载成功', key: 'play' });
    } catch (error) {
        message.error({ content: `播放失败: ${error}`, key: 'play' });
        setCurrentSong(null);
    } finally {
        setPlayingId(null);
    }
  };

  const loadMoreButton = hasMore ? (
    <div style={{ textAlign: "center", marginTop: 12, marginBottom: 8 }}>
      <Button onClick={loadMore} loading={loadingMore}>
        加载更多
      </Button>
    </div>
  ) : null;

  // 4. 根据是否为移动端调整padding
  const contentPadding = isMobile ? "12px" : "24px";
  const cardPadding = isMobile ? "16px" : "24px";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          padding: `env(safe-area-inset-top) ${contentPadding} 0 ${contentPadding}`,
          height: `calc(50px + env(safe-area-inset-top))`,
        }}
      >
        <Title level={3} style={{ color: "white", margin: 0 }}>
          🎶 音乐搜索下载器
        </Title>
      </Header>
      <Content style={{ padding: contentPadding }}>
        <div
          style={{ background: "#fff", padding: cardPadding, borderRadius: 8 }}
        >
          <Search
            placeholder="输入歌曲名、歌手..."
            enterButton="搜索"
            size="large"
            onSearch={handleSearch}
            loading={loading}
          />
          <div style={{ marginTop: 24 }}>
            <Spin spinning={loading} tip="正在网络上玩命搜索中...">
              {songs.length > 0 ? (
                <List
                  bordered
                  dataSource={songs}
                  loadMore={loadMoreButton}
                  renderItem={(item) => (
                    <List.Item>
                      {/* 5. 使用响应式栅格系统重构列表项 */}
                      <Row align="middle" style={{ width: "100%" }}>
                        <Col flex="auto" style={{ minWidth: 0 }}>
                          <List.Item.Meta
                            title={
                              <Text strong ellipsis>
                                {item.title}
                              </Text>
                            }
                            description={
                              <Text type="secondary" ellipsis>
                                歌手: {item.artist}
                              </Text>
                            }
                          />
                        </Col>
                        <Col
                          flex={isMobile ? "100px" : "180px"}
                          style={{ textAlign: "right" }}
                        >
                          <Button
                            type="primary"
                            key="download"
                            loading={downloadingId === item.id}
                            onClick={() => handleDownload(item)}
                            style={{ marginRight: 8 }}
                          >
                            下载
                          </Button>
                          <Button
                            key="play"
                            icon={currentSong?.id === item.id && isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            loading={playingId === item.id}
                            onClick={() => handlePlay(item)}
                            disabled
                          />
                        </Col>
                      </Row>
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
    </Layout>
  );
}

export default App;

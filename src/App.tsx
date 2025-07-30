import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Layout, Input, List, Typography, Spin, Empty, Button, message } from 'antd';
import 'antd/dist/reset.css';

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
  
  // 1. 新增状态，用于跟踪哪个歌曲正在下载
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleSearch = async (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;
    setLoading(true);
    setSearched(true);
    setCurrentKeyword(keyword);
    try {
      const result = await invoke<SearchResult>('search_music', { keyword, page: 1 });
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
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const result = await invoke<SearchResult>('search_music', { keyword: currentKeyword, page: nextPage });
      setSongs(prevSongs => [...prevSongs, ...result.songs]);
      setHasMore(result.has_more);
      setCurrentPage(nextPage);
    } catch (error) {
      console.error("加载更多失败:", error);
      message.error(`加载更多失败: ${error}`);
    } finally {
      setLoadingMore(false);
    }
  };

  // 2. 新增处理下载的函数
  const handleDownload = async (song: Song) => {
    setDownloadingId(song.id); // 设置当前下载中的歌曲ID
    message.loading({ content: `正在解析《${song.title}》的下载链接...`, key: 'download' });

    try {
        await invoke('download_song', {
            songId: song.id,
            title: song.title,
            artist: song.artist,
            keyword: currentKeyword,
        });
        message.success({ content: `《${song.title}》已成功保存！`, key: 'download', duration: 3 });
    } catch (error) {
        // 如果错误是用户取消，则静默处理，否则提示错误
        if (error !== "用户取消了下载") {
             message.error({ content: `下载失败: ${error}`, key: 'download', duration: 3 });
        } else {
            message.destroy('download'); // 用户取消则直接销毁提示
        }
        console.error("下载失败:", error);
    } finally {
        setDownloadingId(null); // 下载结束（无论成功或失败），重置状态
    }
  };


  const loadMoreButton = hasMore ? (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <Button onClick={loadMore} loading={loadingMore}>
        加载更多
      </Button>
    </div>
  ) : null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          🎶 音乐搜索下载器
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
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
                    <List.Item
                      // 3. 更新下载按钮的UI和事件
                      actions={[
                        <Button
                            type="primary"
                            key="download"
                            loading={downloadingId === item.id} // 如果是当前下载项，则显示loading
                            onClick={() => handleDownload(item)}
                        >
                            下载
                        </Button>,
                        <Button key="play" disabled>播放</Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={<Text strong>{item.title}</Text>}
                        description={<Text type="secondary">歌手: {item.artist}</Text>}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                searched && <Empty description="未能找到相关歌曲，换个关键词试试？" />
              )}
            </Spin>
          </div>
        </div>
      </Content>
    </Layout>
  );
}

export default App;
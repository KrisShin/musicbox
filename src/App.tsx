import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { Layout, Input, List, Typography, Spin, Empty, Tag, Space } from 'antd';
import 'antd/dist/reset.css'; // 引入 Antd 的样式重置文件

const { Header, Content } = Layout;
const { Search } = Input;
const { Title, Text } = Typography;

// 1. 定义与 Rust 后端匹配的 TypeScript 接口
// 这有助于代码提示和类型安全
interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number; // 时长（秒）
}

function App() {
  // 2. 定义组件的状态
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // 用于判断是否执行过搜索

  // 格式化时长显示
  const formatDuration = (s: number) => {
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // 3. 定义处理搜索的函数
  const handleSearch = async (value: string) => {
    if (!value) {
      // 如果搜索词为空，则清空列表
      setSongs([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      // 调用我们之前在 Rust 中定义的 `search_music` 命令
      const results = await invoke<Song[]>('search_music', { keyword: value });
      setSongs(results);
    } catch (error) {
      console.error("搜索失败:", error);
      // 在这里可以添加错误提示，例如使用 antd 的 message.error()
    } finally {
      setLoading(false);
    }
  };

  // 4. 渲染UI界面
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
            <Spin spinning={loading} tip="正在玩命搜索中...">
              {songs.length > 0 ? (
                <List
                  bordered
                  dataSource={songs}
                  renderItem={(item) => (
                    <List.Item
                      actions={[<a key="download">下载</a>, <a key="play">播放</a>]}
                    >
                      <List.Item.Meta
                        title={<Text strong>{item.title}</Text>}
                        description={
                          <Space size="middle">
                            <Text type="secondary">歌手: {item.artist}</Text>
                            <Text type="secondary">专辑: {item.album}</Text>
                          </Space>
                        }
                      />
                      <div>
                        <Tag>{formatDuration(item.duration)}</Tag>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                // 只有在执行过搜索且没有结果时，才显示 Empty 状态
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
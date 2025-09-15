import React, { useState, useEffect, useMemo } from "react";
import {
  Flex,
  Image,
  Typography,
  Button,
  List,
  Spin,
  Avatar,
  Modal,
  Input,
  TableProps,
  Table,
} from "antd";
import {
  DownloadOutlined,
  RetweetOutlined,
  PlaySquareOutlined,
  DeleteOutlined,
  CaretDownOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store";
import type { PlaylistInfo, Music, PlaylistMusic } from "../types";
import "./Playlist.css"; // 我们将为它创建专属的 CSS
import { useGlobalMessage } from "../components/MessageHook";

const { Title, Text } = Typography;
const { Search } = Input;

const PlaylistPage: React.FC = () => {
  // --- 全局状态 ---
  const { startPlayback, cyclePlayMode, handleSave } = useAppStore();

  // --- 页面内部状态 ---
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(
    null
  );
  const [selectedPlaylistMusic, setSelectedPlaylistMusic] = useState<
    PlaylistMusic[]
  >([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [isCoverModalVisible, setIsCoverModalVisible] = useState(false);
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null);

  const messageApi = useGlobalMessage();

  const filteredMusic = useMemo(() => {
    if (!searchText) {
      return selectedPlaylistMusic;
    }
    return selectedPlaylistMusic.filter(item =>
      item.music.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.music.artist.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [selectedPlaylistMusic, searchText]);

  // --- 数据获取 ---

  const fetchPlaylists = async () => {
    try {
      const result: PlaylistInfo[] = await invoke("get_all_playlists");
      setPlaylists(result);
      // 如果有歌单，默认选中第一个
      if (result.length > 0) {
        setSelectedPlaylistId(result[0].id);
      }
    } catch (error) {
      messageApi.error("加载歌单列表失败");
      console.error(error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const columns: TableProps<PlaylistMusic>['columns'] = [
    {
      title: '#',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_text, _record, index) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: '歌曲',
      dataIndex: ['music', 'title'],
      key: 'title',
      render: (text, record) => (
        <Flex>
          <Avatar shape="square" size={40} src={record.music.cover_url||'/icon.png'} />
          <Flex vertical justify='center' style={{ marginLeft: 10 }}>
            <Text style={{ maxWidth: 150 }} ellipsis={{ tooltip: text }}>{text}</Text>
            <Text type="secondary" style={{ maxWidth: 150 }} ellipsis={{ tooltip: record.music.artist }}>
              {record.music.artist}
            </Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_text, record) => (
        <Flex gap="small">
          <Button
            type="text"
            shape="circle"
            icon={<DownloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(record.music);
            }}
          />
          <Button
            type="text"
            danger
            shape="circle"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFromPlaylist(record.music);
            }}
          />
        </Flex>
      ),
    },
  ];
  const handleConfirmCoverChange = async () => {
    if (!selectedPlaylistId || !selectedCoverUrl) return;

    try {
      await invoke('update_playlist_cover', {
        playlistId: selectedPlaylistId,
        coverPath: selectedCoverUrl,
      });
      messageApi.success('封面已更新！');
      setIsCoverModalVisible(false);
      setSelectedCoverUrl(null);
      refreshData(); // 重新拉取数据以显示新封面
    } catch (error: any) {
      messageApi.error(`更新封面失败: ${error}`);
    }
  };
  const refreshData = () => {
    fetchPlaylists();  // 刷新左侧所有歌单列表（确保封面更新）
    fetchPlaylistMusic(); // 刷新当前歌单的歌曲列表
  };
  // 1. 组件加载时，获取所有歌单
  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylistMusic = async () => {
    setLoadingMusic(true);
    try {
      const result: PlaylistMusic[] = await invoke("get_music_by_playlist_id", {
        playlistId: selectedPlaylistId,
      });
      setSelectedPlaylistMusic(result);
    } catch (error) {
      messageApi.error("加载歌曲列表失败");
      console.error(error);
    } finally {
      setLoadingMusic(false);
    }
  };
  // 2. 当选中的歌单 ID 变化时，获取该歌单的歌曲列表
  useEffect(() => {
    if (selectedPlaylistId === null) return;

    fetchPlaylistMusic();
  }, [selectedPlaylistId]);

  // --- 派生状态 ---

  // 3. 使用 useMemo 提高性能，避免每次渲染都重新查找
  const selectedPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === selectedPlaylistId);
  }, [playlists, selectedPlaylistId]);

  // --- 事件处理 ---

  // 4. 处理歌单重命名
  const handleRenamePlaylist = async (newName: string) => {
    if (
      !selectedPlaylist ||
      newName.trim() === "" ||
      newName === selectedPlaylist.name
    ) {
      return;
    }
    try {
      await invoke("rename_playlist", {
        playlistId: selectedPlaylist.id,
        newName,
      });
      // 重新加载歌单列表以更新UI
      const updatedPlaylists: PlaylistInfo[] = await invoke(
        "get_all_playlists"
      );
      setPlaylists(updatedPlaylists);
      messageApi.success("歌单已重命名");
    } catch (error) {
      messageApi.error("重命名失败");
      console.error(error);
    }
  };

  const handlePlaySong = (index: number) => {
    // 将 PlaylistMusic[] 转换为 Music[]
    const musicQueue = selectedPlaylistMusic.map((s) => s.music);
    startPlayback(musicQueue, index).catch((error) => console.error(error));
  };

  const handleRemoveFromPlaylist = async (music: Music) => {
    if (!selectedPlaylist) return;
    try {
      await invoke("toggle_music_in_playlist", {
        payload: {
          playlistId: selectedPlaylist.id,
          song_ids: [music.song_id],
        },
      });

      fetchPlaylistMusic();
      messageApi.success(`已从“${selectedPlaylist.name}”中移除`);
    } catch (error) {
      messageApi.error("操作失败");
      console.error(error);
    }
  };

  // [新增] 播放整个歌单的函数
  const handlePlayAll = (mode: "sequence" | "shuffle") => {
    if (selectedPlaylistMusic.length === 0) return;

    // 1. 设置播放模式
    cyclePlayMode(mode); // 假设你在 store 中也添加了 setPlayMode

    // 2. 播放第一首歌
    const musicQueue = selectedPlaylistMusic.map((s) => s.music);
    const startIndex =
      mode === "shuffle" ? Math.floor(Math.random() * musicQueue.length) : 0;
    messageApi.success(
      `${mode === "sequence" ? "顺序" : "随机"} 播放 ${selectedPlaylist?.name || "歌单"
      }, 即将播放 ${musicQueue[startIndex].title}`
    );
    startPlayback(musicQueue, startIndex).catch((error) =>
      console.error(error)
    );
  };

  const handleDownload = async (music: Music) => {
    try {
      messageApi.success(`开始下载 ${music.title}...`);
      handleSave([music])
        .then(async (_: string) => {
          messageApi.destroy();
          messageApi.success(`${music.title}下载完成`);
        })
        .catch((error) => {
          messageApi.destroy();
          messageApi.error(`下载失败: ${error.message || "未知错误"}`);
          return;
        });
    } catch (error) {
      messageApi.destroy();
      messageApi.error(`下载失败: ${error || "未知错误"}`);
      return;
    }
  };

  // --- 渲染 ---

  return (
    <Flex vertical className="playlist-page-container">
      {selectedPlaylist ? (
        <>
          {/* --- 固定的头部 --- */}
          <div className="playlist-header-sticky">
            <Flex vertical gap="small" className="playlist-header">
              {/* ... 封面和信息部分不变 ... */}
              <Flex gap="large" className="header-info-section">
                <Image
                  src={selectedPlaylist?.cover_path || "/icon.png"}
                  width={110}
                  height={110}
                  className="header-cover-img"
                  preview={false} // 关闭默认预览
                  onClick={() => setIsCoverModalVisible(true)} // 点击打开模态框
                  style={{ cursor: 'pointer' }} // 添加手势提示
                />
                <Flex vertical justify="space-between" style={{ flex: 1 }}>
                  <div>
                    <Title
                      level={3}
                      editable={{ onChange: handleRenamePlaylist }}
                      style={{ margin: 0 }}
                    >
                      {selectedPlaylist.name}
                    </Title>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => setIsSelectorVisible(true)}
                      style={{ padding: "0", height: "auto" }}
                    >
                      切换歌单 <CaretDownOutlined />
                    </Button>
                  </div>
                  <Text type="secondary">
                    共 {selectedPlaylist.song_count} 首 · 更新于{" "}
                    {new Date(selectedPlaylist.updated_at).toLocaleDateString()}
                  </Text>
                </Flex>
              </Flex>

              <Flex gap="middle" className="header-actions">
                <Button
                  icon={<PlaySquareOutlined />}
                  onClick={() => handlePlayAll("sequence")}
                >
                  顺序播放
                </Button>
                <Button
                  icon={<RetweetOutlined />}
                  onClick={() => handlePlayAll("shuffle")}
                >
                  随机播放
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  type="primary"
                  onClick={() => {
                    messageApi.info(`正在下载 ${selectedPlaylistMusic.length} 首歌曲...`, 10);
                    handleSave(selectedPlaylistMusic.map(s => s.music)).then(() => {
                      messageApi.destroy();
                      messageApi.success(`全部歌曲下载完成`);
                      fetchPlaylistMusic();
                    })
                  }}>
                  下载全部
                </Button>
              </Flex>
              {/* [新增] 搜索框 */}
              <Search
                placeholder="在歌单中搜索..."
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </Flex>
          </div>

          {/* --- 可滚动的内容 --- */}
          <div className="song-list-scrollable">
            <Spin spinning={loadingMusic}>
              <Table
                rowKey={(record) => record.music.song_id}
                columns={columns}
                dataSource={filteredMusic}
                pagination={false}
                size="small"
                onRow={(_, rowIndex) => ({
                  onClick: () => handlePlaySong(rowIndex!),
                })}
                rowClassName="song-table-row"
              />
            </Spin>
          </div>
        </>
      ) : (
        !loadingPlaylists && (
          <Flex justify="center" align="center" style={{ height: "100%" }}>
            <Text>请选择或创建一个歌单</Text>
          </Flex>
        )
      )}

      {/* 6. [新增] 歌单选择模态框 */}
      <Modal
        title="选择歌单"
        open={isSelectorVisible}
        onCancel={() => setIsSelectorVisible(false)}
        footer={null}
        centered
      >
        <List
          dataSource={playlists}
          renderItem={(p) => (
            <List.Item
              className="playlist-selector-item"
              onClick={() => {
                setSelectedPlaylistId(p.id);
                setIsSelectorVisible(false);
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    shape="square"
                    src={p?.cover_path || "/default_cover.png"}
                  />
                }
                title={p.name}
                description={`${p.song_count} 首歌曲`}
              />
            </List.Item>
          )}
        />
      </Modal>
      <Modal
        title="选择一个新的封面"
        open={isCoverModalVisible}
        onCancel={() => {
          setIsCoverModalVisible(false);
          setSelectedCoverUrl(null); // 关闭时清空选择
        }}
        footer={[
          <Button key="back" onClick={() => {
            setIsCoverModalVisible(false);
            setSelectedCoverUrl(null);
          }}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!selectedCoverUrl} // 如果未选择，则禁用
            onClick={handleConfirmCoverChange}
          >
            确定
          </Button>,
        ]}
        width={600}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px' }}>
          <List
            grid={{ gutter: 16, xs: 3, sm: 4, md: 5, lg: 6 }}
            dataSource={selectedPlaylistMusic.filter(item => item.music.cover_url)} // 过滤掉没有封面的歌曲
            renderItem={item => (
              <List.Item>
                <Image
                  src={item.music.cover_url}
                  preview={false}
                  className={`cover-selector-item ${selectedCoverUrl === item.music.cover_url ? 'selected' : ''}`}
                  onClick={() => setSelectedCoverUrl(item.music.cover_url!)}
                />
              </List.Item>
            )}
          />
        </div>
      </Modal>
    </Flex>
  );
};

export default PlaylistPage;

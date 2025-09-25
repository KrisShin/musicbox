import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Flex,
  Image,
  Typography,
  Button,
  List,
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
  PlusOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store";
import type { PlaylistInfo, Music, PlaylistMusic } from "../types";
import "./Playlist.css"; // 我们将为它创建专属的 CSS
import { useGlobalMessage } from "../components/MessageHook";
import { buildCoverUrl } from "../util";
import { primaryThemeColor } from "../main";

const { Title, Text } = Typography;
const { Search } = Input;

const PlaylistPage: React.FC = () => {
  // --- 全局状态 ---
  const { startPlayback, cyclePlayMode, saveSongWithNotifications, addDownloadingId, removeDownloadingId, currentPlaylistId, setCurrentPlaylistId } = useAppStore();

  // --- 页面内部状态 ---
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);

  const [selectedPlaylistMusic, setSelectedPlaylistMusic] = useState<
    PlaylistMusic[]
  >([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [isCoverModalVisible, setIsCoverModalVisible] = useState(false);
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState(0);

  const messageApi = useGlobalMessage();

  const filteredMusic = useMemo(() => {
    if (!searchText) {
      return selectedPlaylistMusic;
    }
    return selectedPlaylistMusic.filter(
      (item) =>
        item.title.toLowerCase().includes(searchText.toLowerCase()) ||
        item.artist.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [selectedPlaylistMusic, searchText]);

  const uniqueCoverUrls = useMemo(() => {
    // 1. 提取所有 cover_url
    const allCovers = selectedPlaylistMusic
      .map((item) => item.cover_url)
      .filter(Boolean) as string[]; // 过滤掉 null/undefined

    // 2. 使用 Set 自动去重，然后转回数组
    return Array.from(new Set(allCovers));
  }, [selectedPlaylistMusic]);

  // --- 数据获取 ---

  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const result: PlaylistInfo[] = await invoke("get_all_playlists");
      setPlaylists(result);
      // 如果当前没有选中的歌单，并且获取到了歌单，则默认选中第一个
      if (currentPlaylistId === null && result.length > 0) {
        setCurrentPlaylistId(result[0].id);
      }
      return result
    } catch (error) {
      messageApi.error("加载歌单列表失败");
      console.error(error);
    } finally {
      setLoadingPlaylists(false);
    }
  }, [messageApi, currentPlaylistId]); // 依赖 selectedPlaylistId 以避免重复设置

  // 函数2: 获取指定歌单的音乐 (保持独立)
  const fetchPlaylistMusic = useCallback(async () => {
    if (currentPlaylistId === null) return; // 防御性编程
    setLoadingMusic(true);
    try {
      const result: PlaylistMusic[] = await invoke("get_music_by_playlist_id", {
        playlistId: currentPlaylistId,
      });
      setSelectedPlaylistMusic(result);
    } catch (error) {
      messageApi.error("加载歌曲列表失败");
      console.error(error);
    } finally {
      setLoadingMusic(false);
    }
  }, [currentPlaylistId, messageApi]);

  const columns: TableProps<PlaylistMusic>["columns"] = [
    {
      title: "#",
      key: "index",
      width: 16,
      align: "center",
      render: (_text, _record, index) => (
        <Text type="secondary">{index + 1}</Text>
      ),
    },
    {
      title: "歌曲",
      dataIndex: "title",
      key: "title",
      width: "auto",
      ellipsis: true,
      render: (text, record) => (
        <Flex>
          <Avatar
            shape="square"
            size={40}
            src={buildCoverUrl(record.cover_url)}
          />
          <Flex vertical justify="center" style={{ marginLeft: 10 }}>
            <Text style={{ maxWidth: 150 }} ellipsis={{ tooltip: text }}>
              {text}
            </Text>
            <Text
              type="secondary"
              style={{ maxWidth: 150 }}
              ellipsis={{ tooltip: record.artist }}
            >
              {record.artist}
            </Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      align: "center",
      render: (_text, record) => (
        <Flex gap="small">
          <Button
            type="text"
            shape="circle"
            icon={<DownloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(record);
            }}
          />
          <Button
            type="text"
            danger
            shape="circle"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFromPlaylist(record);
            }}
          />
        </Flex>
      ),
    },
  ];
  const handleConfirmCoverChange = async () => {
    if (!currentPlaylistId || !selectedCoverUrl) return;

    try {
      await invoke("update_playlist_cover", {
        playlistId: currentPlaylistId,
        coverPath: selectedCoverUrl,
      });
      messageApi.success("封面已更新！");
      setIsCoverModalVisible(false);
      setSelectedCoverUrl(null);
      refreshData(); // 重新拉取数据以显示新封面
    } catch (error: any) {
      messageApi.error(`更新封面失败: ${error}`);
    }
  };
  const refreshData = useCallback(() => {
    fetchPlaylists();
    if (currentPlaylistId) {
      fetchPlaylistMusic();
    }
  }, [fetchPlaylists, fetchPlaylistMusic, currentPlaylistId]);
  // 1. 组件加载时，获取所有歌单
  useEffect(() => {
    fetchPlaylists();
  }, []); // 空依赖数组确保只运行一次

  // Effect 2: 仅在 currentPlaylistId 变化时获取该歌单的歌曲
  useEffect(() => {
    if (currentPlaylistId !== null) {
      fetchPlaylistMusic();
    }
    const calculateTableHeight = () => {
      if (headerRef.current) {
        // 表格的高度 = 父容器高度 - 头部元素高度
        // 父容器的高度由 App.tsx 的 Flex 布局决定，这里我们直接用 100% 来计算
        // 这里的 15px 是 playlist-header-sticky 的 padding-bottom，需要减去
        const headerHeight = headerRef.current.offsetHeight + 15;
        setTableHeight(headerHeight);
      }
    };

    // 首次计算
    calculateTableHeight();

    // 使用 ResizeObserver 监听头部大小变化，以便在窗口大小调整时重新计算
    const resizeObserver = new ResizeObserver(calculateTableHeight);
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    // 组件卸载时清理 observer
    return () => {
      resizeObserver.disconnect();
    };
  }, [currentPlaylistId, fetchPlaylistMusic]);


  // 3. 使用 useMemo 提高性能，避免每次渲染都重新查找
  const selectedPlaylist = useMemo(() => {
    return playlists.find((p) => p.id === currentPlaylistId);
  }, [playlists, currentPlaylistId]);

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
      refreshData();
      messageApi.success("歌单已重命名");
    } catch (error) {
      messageApi.error("重命名失败");
      console.error(error);
    }
  };

  const handlePlaySong = (index: number) => {
    // 将 PlaylistMusic[] 转换为 Music[]
    startPlayback(selectedPlaylistMusic, index).then(() => !selectedPlaylistMusic[index].cover_url && refreshData()).catch((error) => console.error(error));
  };

  const handleRemoveFromPlaylist = async (music: Music) => {
    if (!selectedPlaylist) return;
    try {
      await invoke("toggle_music_in_playlist", {
        payload: {
          playlist_id: selectedPlaylist.id,
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
    const startIndex =
      mode === "shuffle" ? Math.floor(Math.random() * selectedPlaylistMusic.length) : 0;
    messageApi.success(
      `${mode === "sequence" ? "顺序" : "随机"} 播放 ${selectedPlaylist?.name || "歌单"
      }, 即将播放 ${selectedPlaylistMusic[startIndex].title}`
    );
    startPlayback(selectedPlaylistMusic, startIndex).catch((error) =>
      console.error(error)
    );
  };

  const handleDownload = async (music: Music) => {
    if (useAppStore.getState().downloadingIds.has(music.song_id)) {
      messageApi.destroy()
      messageApi.info('正在下载中, 请稍后重试')
      return
    }
    addDownloadingId(music.song_id)
    try {
      messageApi.success(`开始下载 ${music.title}...`);
      await saveSongWithNotifications([music])
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
    } finally {
      removeDownloadingId(music.song_id)
    }
  };

  const handleCreatePlaylist = async () => {
    await invoke('create_playlist').then(() => {
      messageApi.destroy()
      messageApi.success(`新建歌单完成`)
      fetchPlaylists().then((result: any) => {
        setCurrentPlaylistId(result.at(-1).id)
        fetchPlaylistMusic()
      })
    })
  }
  const handleDeletePlaylist = async (p_id: number) => {
    if (playlists.length === 1) {
      messageApi.destroy()
      messageApi.warning("至少保留一个歌单")
      return
    }
    await invoke('delete_playlist', { playlistId: p_id }).then(() => {
      messageApi.destroy()
      messageApi.success(`删除歌单完成`)
      fetchPlaylists().then((result: any) => {
        setCurrentPlaylistId(p_id === currentPlaylistId ? result.at(0).id : currentPlaylistId)
        fetchPlaylistMusic()
      })
    })
  }

  return (
    <Flex vertical className="playlist-page-container" ref={containerRef}>
      {selectedPlaylist ? (
        <>
          {/* --- 固定的头部 --- */}
          <div className="playlist-header-sticky" ref={headerRef}>
            <Flex vertical gap="small" className="playlist-header">
              {/* ... 封面和信息部分不变 ... */}
              <Flex gap="large" className="header-info-section">
                <Image
                  src={buildCoverUrl(selectedPlaylist?.cover_path)}
                  width={110}
                  height={110}
                  className="header-cover-img"
                  preview={false} // 关闭默认预览
                  onClick={() => setIsCoverModalVisible(true)} // 点击打开模态框
                  style={{ cursor: "pointer" }} // 添加手势提示
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
                <PlusOutlined className="create-playlist-button" style={{ color: primaryThemeColor }} onClick={() => {
                  if (playlists.length < 8) {
                    handleCreatePlaylist()
                    return
                  }
                  messageApi.destroy()
                  messageApi.warning("最多只支持8个歌单")
                }} />
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
                  onClick={async () => {
                    selectedPlaylistMusic.map((music: Music) => {
                      addDownloadingId(music.song_id)
                    })
                    messageApi.info(
                      `正在下载 ${selectedPlaylistMusic.length} 首歌曲...`,
                      5
                    );
                    await saveSongWithNotifications(selectedPlaylistMusic).then(
                      () => {
                        messageApi.destroy();
                        messageApi.success(`全部歌曲下载完成`);
                      }
                    ).finally(() => selectedPlaylistMusic.map((music: Music) => {
                      removeDownloadingId(music.song_id)
                    }));
                  }}
                >
                  下载全部
                </Button>
              </Flex>
              {/* [新增] 搜索框 */}
              <Search
                placeholder="在歌单中搜索..."
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: "100%" }}
              />
            </Flex>
          </div>
          {/* --- 可滚动的内容 --- */}
          <div className="song-list-scrollable">
            <Table
              virtual
              scroll={{ y: (containerRef.current?.offsetHeight || 600) - tableHeight - 24 }}
              loading={loadingMusic}
              rowKey={(record) => record.song_id}
              columns={columns}
              dataSource={filteredMusic}
              pagination={false}
              size="small"
              onRow={(_, rowIndex) => ({
                onClick: () => handlePlaySong(rowIndex!),
              })}
              rowClassName="song-table-row"
            />
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
                setCurrentPlaylistId(p.id);
                setIsSelectorVisible(false);
              }}
              actions={[<DeleteOutlined style={{ color: "red", padding: "0.8rem" }} onClick={(e) => { e?.stopPropagation(); handleDeletePlaylist(p.id); }} />]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    shape="square"
                    src={p?.cover_path || "/icon.png"}
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
          <Button
            key="back"
            onClick={() => {
              setIsCoverModalVisible(false);
              setSelectedCoverUrl(null);
            }}
          >
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
        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "0.625rem" }}>
          <List
            grid={{ gutter: 16, xs: 3, sm: 4, md: 5, lg: 6 }}
            dataSource={uniqueCoverUrls} // 过滤掉没有封面的歌曲
            renderItem={(item) => (
              <List.Item>
                <Image
                  src={buildCoverUrl(item)}
                  preview={false}
                  className={`cover-selector-item ${selectedCoverUrl === item ? "selected" : ""
                    }`}
                  onClick={() => setSelectedCoverUrl(item!)}
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

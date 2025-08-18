import React, { useState, useEffect, useMemo } from 'react';
import { Flex, Image, Typography, Button, List, Spin, Avatar, Modal } from 'antd';
import { DownloadOutlined, RetweetOutlined, PlaySquareOutlined, DeleteOutlined, CaretDownOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store';
import type { PlaylistInfo, Music, PlaylistMusic } from '../types';
import './Playlist.css'; // 我们将为它创建专属的 CSS
import { useGlobalMessage } from '../components/MessageHook';

const { Title, Text } = Typography;

const PlaylistPage: React.FC = () => {
  // --- 全局状态 ---
  const { handleDetail } = useAppStore();

  // --- 页面内部状态 ---
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [selectedPlaylistMusic, setSelectedPlaylistMusic] = useState<PlaylistMusic[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);

  const messageApi = useGlobalMessage();


  // --- 数据获取 ---

  const fetchPlaylists = async () => {
    try {
      const result: PlaylistInfo[] = await invoke('get_all_playlists');
      setPlaylists(result);
      // 如果有歌单，默认选中第一个
      if (result.length > 0) {
        setSelectedPlaylistId(result[0].id);
      }
    } catch (error) {
      messageApi.error('加载歌单列表失败');
      console.error(error);
    } finally {
      setLoadingPlaylists(false);
    }
  };
  // 1. 组件加载时，获取所有歌单
  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylistMusic = async () => {
    setLoadingMusic(true);
    try {
      const result: PlaylistMusic[] = await invoke('get_music_by_playlist_id', { playlistId: selectedPlaylistId });
      setSelectedPlaylistMusic(result);
    } catch (error) {
      messageApi.error('加载歌曲列表失败');
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
    return playlists.find(p => p.id === selectedPlaylistId);
  }, [playlists, selectedPlaylistId]);

  // --- 事件处理 ---

  // 4. 处理歌单重命名
  const handleRenamePlaylist = async (newName: string) => {
    if (!selectedPlaylist || newName.trim() === '' || newName === selectedPlaylist.name) {
      return;
    }
    try {
      await invoke('rename_playlist', { playlistId: selectedPlaylist.id, newName });
      // 重新加载歌单列表以更新UI
      const updatedPlaylists: PlaylistInfo[] = await invoke('get_all_playlists');
      setPlaylists(updatedPlaylists);
      messageApi.success('歌单已重命名');
    } catch (error) {
      messageApi.error('重命名失败');
      console.error(error);
    }
  };

  // 5. 点击歌曲列表中的一行时播放
  const handlePlaySong = (song: Music, index: number) => {
    // 这里可以复用 handleDetail 来加载并播放歌曲
    // 也可以创建一个新的 store action 来“播放一个列表”，以便实现上下文播放（上一首/下一首）
    handleDetail(song, index);
  }

  const handleRemoveFromPlaylist = async (music: Music) => {
    if (!selectedPlaylist) return;
    try {
      await invoke('toggle_music_in_playlist', {
        payload: {
          playlistId: selectedPlaylist.id,
          song_ids: [music.song_id],
        },
      });

      fetchPlaylistMusic()
      messageApi.success(`已从“${selectedPlaylist.name}”中移除`);
    } catch (error) {
      messageApi.error('操作失败');
      console.error(error);
    }
  };

  // --- 渲染 ---

  return (
    <div className="playlist-page-container">
      {/* 4. [重构] 响应式的头部 */}
      {selectedPlaylist ? (
        <Flex vertical gap="middle" className="playlist-header">
          {/* 封面和信息 */}
          <Flex gap="large" className="header-info-section" >
            <Image
              src={selectedPlaylist?.cover_path?.replace('http://', 'https://') || '/default_cover.png'}
              width={120} height={120}
              className="header-cover-img"
            />
            <Flex vertical justify="space-between" style={{ flex: 1 }}>
              <div>
                <Title level={3} editable={{ onChange: handleRenamePlaylist }} style={{ margin: 0 }}>
                  {selectedPlaylist.name}
                </Title>
                {/* [新增] 切换歌单的按钮 */}
                <Button type="text" size="small" onClick={() => setIsSelectorVisible(true)} style={{ padding: '0', height: 'auto' }}>
                  切换歌单 <CaretDownOutlined />
                </Button>
              </div>
              <Text type="secondary">
                共 {selectedPlaylist.song_count} 首 · 更新于 {new Date(selectedPlaylist.updated_at).toLocaleDateString()}
              </Text>
            </Flex>
          </Flex>
          {/* 操作按钮 */}
          <Flex gap="middle" className="header-actions">
            <Button type="primary" icon={<PlaySquareOutlined />}>顺序播放</Button>
            <Button type="primary" icon={<RetweetOutlined />}>随机播放</Button>
            <Button type="primary" icon={<DownloadOutlined />} disabled>下载全部</Button>
          </Flex>
        </Flex>
      ) : (
        !loadingPlaylists && <Flex justify="center" align="center" style={{ height: '100%' }}><Text>请选择或创建一个歌单</Text></Flex>
      )}

      {/* 5. [重构] 歌曲列表 */}
      <Spin spinning={loadingMusic}>
        <div className="song-list-container">
          <List
            size='small'
            dataSource={selectedPlaylistMusic}
            renderItem={(playlistSong, index) => (
              <List.Item
                className="song-list-item"
                onClick={() => handlePlaySong(playlistSong.music, index)}
                actions={[
                  <Button type="text" shape="circle" icon={<DownloadOutlined />} onClick={(e) => { e.stopPropagation(); /* ... */ }} />,
                  // [新增] 移除按钮
                  <Button type="text" danger shape="circle" icon={<DeleteOutlined />} onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFromPlaylist(playlistSong.music);
                  }} />
                ]}
              >
                <List.Item.Meta
                  avatar={<Text style={{ width: '20px', textAlign: 'center' }}>{index + 1}</Text>}
                  title={<Text ellipsis>{playlistSong.music.title}</Text>}
                  description={<Text ellipsis type="secondary">{playlistSong.music.artist}</Text>}
                />
              </List.Item>
            )}
          />
        </div>
      </Spin>

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
          renderItem={p => (
            <List.Item
              className="playlist-selector-item"
              onClick={() => {
                setSelectedPlaylistId(p.id);
                setIsSelectorVisible(false);
              }}
            >
              <List.Item.Meta
                avatar={<Avatar shape="square" src={p.cover_path || '/default_cover.png'} />}
                title={p.name}
                description={`${p.song_count} 首歌曲`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>

  );
};

export default PlaylistPage;
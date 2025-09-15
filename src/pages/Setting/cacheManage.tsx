// src/pages/Setting/CacheManage.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Flex, List, Spin, Statistic, Typography } from 'antd';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeftOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGlobalMessage, useGlobalModal } from '../../components/MessageHook';
import { primaryThemeColor } from '../../main';
import { useAppStore } from '../../store';

const { Text } = Typography;

// 定义从后端接收的数据类型
interface CacheAnalysisResult {
  total_size_str: string;
  song_ids: string[];
  count: number;
}

interface PlaylistCacheInfo {
  id: number;
  name: string;
  cover_path: string | null;
  cached_song_count: number;
  cached_size_str: string;
}

const CacheManagePage: React.FC = () => {
  const navigate = useNavigate();
  const messageApi = useGlobalMessage();
  const modalApi = useGlobalModal();
  const [loading, setLoading] = useState(true);

  const [totalSize, setTotalSize] = useState("0 B");
  const [nonPlaylistInfo, setNonPlaylistInfo] = useState<CacheAnalysisResult | null>(null);
  const [oldCacheInfo, setOldCacheInfo] = useState<CacheAnalysisResult | null>(null);
  const [playlistsInfo, setPlaylistsInfo] = useState<PlaylistCacheInfo[]>([]);
  const { currentMusic, handleClose } = useAppStore();

  // 拉取所有缓存数据的函数
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        size,
        nonPlaylist,
        oldCache,
        playlists
      ] = await Promise.all([
        invoke<string>('get_cache_size'),
        invoke<CacheAnalysisResult>('get_non_playlist_cache_info'),
        invoke<CacheAnalysisResult>('get_old_cache_info'),
        invoke<PlaylistCacheInfo[]>('get_all_playlists_cache_info')
      ]);
      setTotalSize(size);
      setNonPlaylistInfo(nonPlaylist);
      setOldCacheInfo(oldCache);
      setPlaylistsInfo(playlists);
    } catch (error: any) {
      messageApi.error(`加载缓存信息失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 通用的清理函数
  const handleClear = (
    songIds: string[],
    title: string,
    content: string,
    onSuccess: () => void
  ) => {
    if ((!songIds || songIds.length === 0) && totalSize === "0 B") {
      messageApi.info('没有可清理的缓存');
      return;
    }

    modalApi.confirm({
      title: title,
      content: content,
      okText: '确认清理',
      cancelText: '取消',
      onOk: async () => {
        try {
          messageApi.loading('正在清理中...', 0);
          // 如果当前播放的歌曲在被清理的列表中或者清空所有缓存，则关闭播放器
          if (currentMusic && songIds.includes(currentMusic.song_id) || songIds.length === 0) handleClose();
          await invoke('clear_cache_by_ids', { songIds });
          messageApi.destroy();
          messageApi.success('清理成功！');
          onSuccess(); // 清理成功后执行回调，例如刷新数据
        } catch (error: any) {
          messageApi.destroy();
          messageApi.error(`清理失败: ${error}`);
        }
      },
    });
  };

  const handleClearAll = async () => {
    handleClear([], '清理所有缓存', '确定要删除所有已缓存的歌曲吗？所有的播放文件将重新加载缓存', fetchData);
  }

  return (
    <Spin spinning={loading}>
      <Flex vertical gap="16px">
        <Card
          title={
            <Flex align="center">
              <ArrowLeftOutlined
                onClick={() => navigate(-1)}
                style={{ marginRight: '16px', color: primaryThemeColor, fontSize: '16px' }}
              />
              <span>缓存管理</span>
            </Flex>
          }
        >
          <Card.Grid hoverable={false} style={{ width: '100%', textAlign: 'center' }}>
            <Statistic title="当前缓存总大小" value={totalSize} />
          </Card.Grid>
        </Card>

        <Card title="智能清理">
          <List itemLayout="horizontal">
            <List.Item
              actions={[
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleClear(
                    nonPlaylistInfo?.song_ids || [],
                    '清理非播放列表缓存',
                    `确定要删除 ${nonPlaylistInfo?.count || 0} 首未在任何播放列表中的歌曲缓存吗？`,
                    fetchData
                  )}
                >
                  清理
                </Button>
              ]}
            >
              <List.Item.Meta
                title="清除非播放列表中的缓存"
                description={`可释放 ${nonPlaylistInfo?.total_size_str || '0 B'} (${nonPlaylistInfo?.count || 0} 首)`}
              />
            </List.Item>

            <List.Item
              actions={[
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleClear(
                    oldCacheInfo?.song_ids || [],
                    '清理长期未播放缓存',
                    `确定要删除 ${oldCacheInfo?.count || 0} 首超过3个月未播放的歌曲缓存吗？`,
                    fetchData
                  )}
                >
                  清理
                </Button>
              ]}
            >
              <List.Item.Meta
                title="清除超过3个月未播放的缓存"
                description={`可释放 ${oldCacheInfo?.total_size_str || '0 B'} (${oldCacheInfo?.count || 0} 首)`}
              />
            </List.Item>

            <List.Item
              actions={[<Button
                danger
                type="primary"
                icon={<DeleteOutlined />}
                onClick={handleClearAll}>清空</Button>]}
            >
              <List.Item.Meta
                title={<Text type="danger">清除所有缓存</Text>}
                description="将删除所有已下载的歌曲，释放全部空间, 会导致播放音乐重新加载"
              />
            </List.Item>
          </List>
        </Card>

        <Card title="歌单管理">
          <List
            itemLayout="horizontal"
            dataSource={playlistsInfo}
            renderItem={(item) => (
              // [修改] 让整个列表项可点击
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/setting/cache/playlist/${item.id}`, { state: { playlistName: item.name } })}
              >
                <List.Item.Meta
                  avatar={<img width={48} alt="cover" src={item.cover_path || '/icon.png'} />}
                  title={item.name}
                  description={`${item.cached_song_count} 首已缓存, 约 ${item.cached_size_str}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Flex>
    </Spin>
  );
};

export default CacheManagePage;
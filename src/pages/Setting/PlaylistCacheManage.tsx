// src/pages/Setting/ManualCacheManage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom"; // 导入新 hooks
import { invoke } from "@tauri-apps/api/core";
import { Table, Input, Button, Flex, Typography, Space, Tag } from "antd";
import type { TableProps } from "antd";
import { ArrowLeftOutlined, DeleteOutlined } from "@ant-design/icons";
import { useGlobalMessage, useGlobalModal } from "../../components/MessageHook";
import { primaryThemeColor } from "../../main";
import { buildCoverUrl, formatRelativeTime, formatSize } from "../../util";
import { useAppStore } from "../../store";
import { CachedMusicInfo } from "../../types";

const { Title, Text } = Typography;
const { Search } = Input;

// 定义从后端接收的歌曲信息类型

const PlaylistCacheManagePage: React.FC = () => {
  const navigate = useNavigate();
  const { playlistId } = useParams<{ playlistId: string }>(); // 从 URL 获取 playlistId
  const location = useLocation(); // 获取导航时传递的 state
  const playlistName = location.state?.playlistName || "歌单";

  const messageApi = useGlobalMessage();
  const modalApi = useGlobalModal();
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<CachedMusicInfo[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { currentMusic, handleClose } = useAppStore();
  const pageRef = useRef<HTMLElement | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)

  const fetchData = useCallback(async () => {
    if (!playlistId) return;
    setLoading(true);
    try {
      // [修改] 调用新的、需要 playlistId 的接口
      const result = await invoke<CachedMusicInfo[]>(
        "get_cached_music_for_playlist",
        {
          playlistId: Number(playlistId),
        }
      );
      setSongs(result);
    } catch (error: any) {
      messageApi.error(`加载歌曲列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [playlistId, messageApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 根据搜索文本过滤数据
  const filteredSongs = useMemo(() => {
    if (!searchText) {
      return songs;
    }
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(searchText.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [songs, searchText]);

  // 清理按钮的处理函数
  const handleClear = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.info("请至少选择一首歌曲");
      return;
    }
    modalApi.confirm({
      title: "确认清理",
      content: `确定要删除选中的 ${selectedRowKeys.length} 首歌曲的缓存吗？此操作不可恢复。`,
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          if (
            (currentMusic && selectedRowKeys.includes(currentMusic.song_id)) ||
            selectedRowKeys.length === 0
          )
            handleClose();
          await invoke("clear_cache_by_ids", { songIds: selectedRowKeys });
          messageApi.success("清理成功！");
          setSelectedRowKeys([]); // 清空选择
          fetchData(); // 重新加载数据
        } catch (error: any) {
          messageApi.error(`清理失败: ${error}`);
        }
      },
    });
  };

  // 表格列的定义
  // [优化] 表格列定义，根据是否为移动端动态调整
  const columns: TableProps<CachedMusicInfo>["columns"] = [
    {
      title: "歌曲",
      dataIndex: "title",
      key: "title",
      width: 200,
      render: (text, record) => (
        <Flex>
          <img
            src={buildCoverUrl(record.cover_url)}
            alt={text}
            style={{ width: 40, height: 40, marginRight: 10, borderRadius: 4 }}
          />
          <Flex vertical justify="center">
            <Text style={{ maxWidth: 120 }} ellipsis={{ tooltip: text }}>
              {text}
            </Text>
            <Text
              type="secondary"
              style={{ maxWidth: 120 }}
              ellipsis={{ tooltip: record.artist }}
            >
              {record.artist}
            </Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "上次",
      dataIndex: "last_played_at",
      key: "last_played",
      sorter: (a, b) =>
        new Date(a.last_played_at || 0).getTime() -
        new Date(b.last_played_at || 0).getTime(),
      // 使用新的时间格式化函数
      render: (time) => formatRelativeTime(time),
      width: 80,
      align: "right",
    },
    {
      title: "大小",
      dataIndex: "file_size_bytes",
      key: "size",
      sorter: (a, b) => a.file_size_bytes - b.file_size_bytes,
      render: (size) => formatSize(size),
      width: 80,
      align: "right",
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };
  return (
    <Flex vertical style={{ height: "100%", background: "#fff" }} ref={pageRef}>
      {/* 2. 顶部导航栏和搜索栏保持不变，它们会自然占据所需的高度。
               我们添加 flexShrink: 0 来确保它们在空间不足时不会被压缩。 */}
      <Flex vertical ref={headerRef}>
        <Flex
          align="center"
          justify="space-between"
          style={{
            padding: "0.625rem 0.9375rem",
            borderBottom: "0.0625rem solid #f0f0f0",
            flexShrink: 0,
          }}
        >
          <Space>
            <ArrowLeftOutlined
              style={{
                marginRight: "1rem",
                color: primaryThemeColor,
                fontSize: "1rem",
              }}
              onClick={() => navigate(-1)}
            />
            <Title
              level={5}
              style={{ margin: 0 }}
              ellipsis={{ tooltip: playlistName }}
            >
              {playlistName}
            </Title>
          </Space>
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={handleClear}
          >
            清理
          </Button>
        </Flex>

        <Flex
          justify="space-between"
          align="center"
          style={{ padding: "0.625rem 0.9375rem", flexShrink: 0 }}
        >
          <Search
            placeholder="搜索歌名或歌手"
            onSearch={setSearchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
          />
          <Tag color="blue">{`共 ${filteredSongs.length} 首，已选 ${selectedRowKeys.length} 首`}</Tag>
        </Flex>
      </Flex>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Table
          virtual
          scroll={{ y: (pageRef.current?.offsetHeight || 800) - (headerRef.current?.offsetHeight || 0) - 40 }}
          rowKey="song_id"
          columns={columns}
          dataSource={filteredSongs}
          loading={loading}
          rowSelection={rowSelection}
          pagination={false}
          size={"small"}
        />
      </div>
    </Flex>
  );
};

export default PlaylistCacheManagePage;

import React, { useEffect } from 'react';
import { Input, Spin, Empty, Button, Flex, TableProps, Typography, Table } from 'antd';
import { primaryThemeColor } from '../main';
import { useAppStore } from '../store';
import { useGlobalMessage } from '../components/MessageHook';
import { DownloadOutlined } from "@ant-design/icons";
import { Music } from '../types';
import AddToPlaylistButton from '../components/Add2Playlist';

const { Search } = Input;
const { Text } = Typography;

const SearchPage: React.FC = () => {
  const {
    loading,
    musicList,
    hasMore,
    searched,
    handleSearch,
    startPlayback,
    currentKeyword,
    saveSongWithNotifications,
    downloadingIds,
    addDownloadingId,
    removeDownloadingId,
  } = useAppStore();

  const messageApi = useGlobalMessage();

  const onSearch = async (keyword: string) => {
    try {
      messageApi.destroy();
      messageApi.success(`搜索 "${keyword}" 中...`, 1.5);
      await handleSearch(keyword).then(() => {
        messageApi.destroy();
        messageApi.success(`搜索 "${keyword}" 成功`);
      })
    } catch (error: any) {
      // 在这里捕获 store 抛出的错误，并调用 messageApi
      if (error.message === "404") {
        messageApi.destroy();
        messageApi.warning("未能找到相关歌曲, 请更换搜索关键词");
      } else {
        messageApi.destroy();
        messageApi.error(error.message || "搜索时发生未知错误");
      }
    }
  };

  const handlePlayFromSearch = (index: number) => {
    // 关键：将整个 musicList 作为播放队列传入
    startPlayback(musicList, index).then(() => {
      messageApi.destroy();
      messageApi.success(`开始播放 ${musicList[index].title}`);
    }).catch(error => {
      // 可以在这里处理 messageApi 的错误提示
      console.error(error);
    });
  };

  const handleDownload = async (music: Music) => {
    if (downloadingIds.has(music.song_id)) {
      messageApi.info("这首歌正在下载中...");
      return;
    }

    addDownloadingId(music.song_id);
    messageApi.open({
      type: "loading",
      content: `开始下载 ${music.title}...`,
      duration: 0,
    });

    try {
      await saveSongWithNotifications([music]);
      messageApi.destroy();
      messageApi.success(`${music.title} 下载完成`);
    } catch (error: any) {
      messageApi.destroy();
      messageApi.error(`下载失败: ${error.message || "未知错误"}`);
    } finally {
      removeDownloadingId(music.song_id);
    }
  };

  const columns: TableProps<Music>["columns"] = [
    {
      title: "#",
      key: "index",
      width: "1rem",
      align: "center",
      render: (_text, _record, index) => (
        <Text type="secondary">{index + 1}</Text>
      ),
    },
    {
      title: "歌曲",
      dataIndex: "title",
      key: "title",
      ellipsis:true,
      render: (text, record) => (
        <Flex vertical justify="center" >
          <Text ellipsis={{ tooltip: text }}>
            {text}
          </Text>
          <Text
            type="secondary"
            ellipsis={{ tooltip: record.artist }}
          >
            {record.artist}
          </Text>
        </Flex>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: "5rem",
      align: "center",
      render: (_text, record) => (
        <Flex gap="small" justify="center">
          <AddToPlaylistButton song={record} primaryThemeColor={primaryThemeColor} />
          <Button
            type="text"
            shape="circle"
            icon={<DownloadOutlined />}
            loading={downloadingIds.has(record.song_id)} // loading 状态绑定
            onClick={(e) => {
              e.stopPropagation(); // 阻止事件冒泡触发行点击
              handleDownload(record);
            }}
          />
        </Flex>
      ),
    },
  ];

  useEffect(() => {
    // 组件加载时执行一次默认搜索
    // onSearch('热门');
  }, [handleSearch]);

  return (
    <>
      <div style={{ padding: "0.3125rem", background: '#fff5f5' }}>
        <Search
          placeholder="输入歌曲名、歌手..."
          enterButton="搜索"
          size="large"
          onSearch={onSearch}
          loading={loading}
        />
      </div>
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          margin: "0 auto",
          transition: "padding-bottom 0.3s ease-in-out",
        }}
      >
        <Spin spinning={loading && musicList.length === 0} tip="正在玩命搜索中...">
          {musicList.length > 0 ? (
            <Table
              style={{ flex: 1 }} // 让表格占满 Spin 容器
              rowKey={(record) => record.song_id}
              columns={columns}
              dataSource={musicList}
              pagination={false}
              size="small"
              onRow={(_record, rowIndex) => ({
                onClick: () => handlePlayFromSearch(rowIndex!),
              })}
              rowClassName="song-table-row" // 可以复用歌单页的点击行样式
            />
          ) : (
            searched && <Empty description="未能找到相关歌曲，换个关键词试试？" />
          )}
          {hasMore && (
            <Flex justify="center" style={{ padding: '0.3125rem 0' }}>
              <Button
                type="primary"
                loading={loading}
                onClick={() => onSearch(currentKeyword)}
              >
                加载更多
              </Button>
            </Flex>
          )}
        </Spin>
      </div>
    </>
  );
};

export default SearchPage;
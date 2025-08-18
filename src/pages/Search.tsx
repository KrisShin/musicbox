import React, { useEffect } from 'react';
import { Input, List, Spin, Empty, Button, Flex } from 'antd';
import MusicListItem from '../components/MusicList';
import { primaryThemeColor } from '../main';
import { useAppStore } from '../store';
import { useGlobalMessage } from '../components/MessageHook';

const { Search } = Input;

const SearchPage: React.FC = () => {
  const {
    loading,
    musicList,
    hasMore,
    searched,
    handleSearch,
    startPlayback,
    currentKeyword
  } = useAppStore();

  const messageApi = useGlobalMessage();

  const onSearch = async (keyword: string) => {
    try {
      messageApi.success(`搜索 "${keyword}" 中...`, 1.5);
      await handleSearch(keyword).then(() => {
        messageApi.success(`搜索 "${keyword}" 成功`);
      });
    } catch (error: any) {
      // 在这里捕获 store 抛出的错误，并调用 messageApi
      if (error.message === "404") {
        messageApi.warning("未能找到相关歌曲, 请更换搜索关键词");
      } else {
        messageApi.error(error.message || "搜索时发生未知错误");
      }
    }
  };

  const handlePlayFromSearch = (index: number) => {
    // 关键：将整个 musicList 作为播放队列传入
    startPlayback(musicList, index).then(() => {
      messageApi.success(`开始播放 ${musicList[index].title}`);
    }).catch(error => {
      // 可以在这里处理 messageApi 的错误提示
      console.error(error);
    });
  };

  useEffect(() => {
    // 组件加载时执行一次默认搜索
    // onSearch('热门');
  }, [handleSearch]);

  return (
    <>
      <div style={{ padding: "5px", background: '#fff5f5' }}>
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
          maxWidth: "800px",
          margin: "0 auto",
          transition: "padding-bottom 0.3s ease-in-out",
        }}
      >
        <Spin spinning={loading && musicList.length === 0} tip="正在玩命搜索中...">
          {musicList.length > 0 ? (
            <List
              style={{ padding: "8px" }}
              dataSource={musicList}
              renderItem={(item, index) => (
                <MusicListItem
                  item={item}
                  index={index}
                  primaryThemeColor={primaryThemeColor}
                  handleDetail={handlePlayFromSearch}
                />
              )}
            />
          ) : (
            searched && <Empty description="未能找到相关歌曲，换个关键词试试？" />
          )}
          {hasMore && (
            <Flex justify="center" style={{ padding: '5px 0' }}>
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
import { useEffect, useRef, useState } from 'react';
import { Layout, Typography, Image, Flex } from 'antd';
import SearchPage from './pages/Search';
import PlaylistPage from './pages/Playlist';
import PlayerPage from './pages/Player';
import BottomNav from './components/BottomNav';
import PlayerBar from './components/PlayerBar';
import './App.css';
import { useAppStore } from './store';

const { Header } = Layout;
const { Title } = Typography;

const AppHeader = () => (
  <div style={{ position: "sticky", top: 0, zIndex: 10, background: '#fcf0f0ff' }}>
    <Header
      style={{
        backgroundColor: "#fff5f5",
        borderBottom: "1px solid #ffb5b5ff",
        display: "flex",
        justifyContent: "center",
        padding: `env(safe-area-inset-top) 16px 4px 16px`,
        height: `calc(75px + env(safe-area-inset-top))`,
      }}
    >
      <Flex align="end" gap={1}>
        <Image src="/header_icon.png" preview={false} width={25} height={25} />
        <Title level={3} style={{ margin: 0, color: "#333333", lineHeight: 1 }}>MusicBox</Title>
      </Flex>
    </Header>
  </div>
);

// 主应用内容组件
const App = () => {
  const [activeTab, setActiveTab] = useState('search');
  const {
    currentMusic, isPlaying, handlePlayPause, handleSave, handleNext, handlePrev, handleClose,
  } = useAppStore();

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // --- 同步歌曲源 ---
    if (currentMusic && currentMusic.play_url) {
      if (audio.src !== currentMusic.play_url) {
        audio.src = currentMusic.play_url;
        // 当源改变时，我们期望它能自动播放
        if (isPlaying) {
          audio.play().catch(e => console.error("自动播放失败:", e));
        }
      }
    } else {
      // 如果没有歌曲或播放链接，则清空
      audio.src = "";
    }

    // --- 同步播放/暂停状态 ---
    if (isPlaying) {
      // 检查是否已暂停，避免不必要的 play() 调用
      if (audio.paused) {
        audio.play().catch(e => console.error("播放失败:", e));
      }
    } else {
      // 检查是否正在播放，避免不必要的 pause() 调用
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [currentMusic, isPlaying]); // 同时监听歌曲和播放状态的变化

  const renderContent = () => {
    switch (activeTab) {
      case 'search':
        return <SearchPage />;
      case 'playlist':
        return <PlaylistPage />;
      case 'player':
        return <PlayerPage />;
      default:
        return <SearchPage />;
    }
  };

  const contentPaddingBottom = currentMusic ? "110px" : "70px";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMusic?.play_url) {
      handleClose(); // 如果没有播放链接，就关闭播放器
      return;
    };

    if (audio.src !== currentMusic.play_url) {
      audio.src = currentMusic.play_url;
    }

    const handleTimeUpdate = () => {
      // 注意：currentTime 不再需要全局 state，可以直接从 ref 读取用于 PlayerBar
      // 如果其他组件也需要，可以考虑放回 store
    };
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      // ... remove listeners
    };
  }, [currentMusic, handleNext]);

  return (
    <Layout style={{ minHeight: "100vh", backgroundColor: "#fcf0f0ff" }}>
      <AppHeader />

      {/* 动态计算 Content 的 paddingBottom */}
      <div style={{ paddingBottom: contentPaddingBottom, transition: 'padding-bottom 0.3s' }}>
        {renderContent()}
      </div>

      {/* 全局播放器和 audio 标签 */}
      <PlayerBar
        audioRef={audioRef}
        currentMusic={currentMusic}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSave={handleSave}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={handleClose}
      />
      <audio ref={audioRef} style={{ display: "none" }} />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </Layout>
  );
}

export default App;
import { useEffect, useRef } from 'react';
import { Layout, Typography, Image, Flex } from 'antd';
import SearchPage from './pages/Search';
import PlaylistPage from './pages/Playlist';
import PlayerPage from './pages/Player';
import SettingPage from './pages/Setting';
import AboutPage from './pages/Setting/About';
import BottomNav from './components/BottomNav';
import './App.css';
import { useAppStore } from './store';
import { Content } from 'antd/es/layout/layout';
import FloatPlayer from './components/FloatPlayer';
import { useGlobalMessage, useGlobalModal } from './components/MessageHook';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { checkForUpdates } from './util/updater';
import PrivacyPage from './pages/Setting/Privacy';
import CacheManagePage from './pages/Setting/cacheManage';
import { invoke } from '@tauri-apps/api/core';
import PlaylistCacheManagePage from './pages/Setting/PlaylistCacheManage';

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
        <Image src="/header_icon.png" preview={false} wrapperStyle={{ display: 'inline-flex', height: '25px' }} width='25px' />
        <Title level={3} style={{ margin: 0, color: "#333333", lineHeight: 1 }}>MusicBox</Title>
      </Flex>
    </Header>
  </div>
);

// 主应用内容组件
const AppContent = () => {
  const location = useLocation();
  const {
    currentMusic, isPlaying, handlePlayPause, handleNext, handleClose,
    setCurrentTime, // 获取新的 action
    setDuration,   // 获取新的 action
  } = useAppStore();

  const messageApi = useGlobalMessage();
  const modalApi = useGlobalModal();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // --- 同步歌曲源 ---
    if (currentMusic && currentMusic.file_path) {
      if (audio.src !== currentMusic.file_path) {
        audio.src = currentMusic.file_path;
      }
    } else {
      audio.src = "";
    }

    // --- 同步播放/暂停状态 ---
    setTimeout(() => {
      if (isPlaying) {
        // 检查是否已暂停，避免不必要的 play() 调用
        if (audio.paused) {
          if (!currentMusic?.file_path) return; // 如果没有播放链接，就不尝试播放
          invoke("update_music_last_play_time", { songId: currentMusic.song_id }).catch(console.error);
          audio.play().catch(e => console.error("播放失败:", e));
        }
      } else {
        // 检查是否正在播放，避免不必要的 pause() 调用
        if (!audio.paused) {
          audio.pause();
        }
      }
    }, 90)
  }, [currentMusic, isPlaying]); // 同时监听歌曲和播放状态的变化

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
    };
  }, [setCurrentTime, setDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMusic?.file_path) {
      handleClose(); // 如果没有播放链接，就关闭播放器
      return;
    };

    if (audio.src !== currentMusic.file_path) {
      audio.src = currentMusic.file_path;
      if (isPlaying && !audio.played) {
        invoke("update_music_last_play_time", { songId: currentMusic.song_id }).catch(console.error);
        audio.play().catch(e => console.error("自动播放失败:", e));
      }
    }
  }, [currentMusic, handleNext]);

  useEffect(() => {
    const timer = setTimeout(() => { checkForUpdates({ force: false, messageApi, modalApi }); }, 1000);
    return () => clearTimeout(timer);
  }, [messageApi, modalApi]);

  return (
    // 1. [核心改动] 将根 Layout 设置为固定屏幕高度的 Flex 容器
    <Layout style={{ height: "100vh", display: 'flex', flexDirection: 'column', backgroundColor: "#fcf0f0ff" }}>
      {/* Header 部分不变，它占据固定高度 */}
      <AppHeader />

      {/* 2. [核心改动] 使用 Antd 的 Content 组件作为弹性滚动区域 */}
      <Content
        style={{
          flex: 1, // 关键：让这个区域占据所有剩余的可用空间
          overflowY: 'auto', // 关键：只在这个区域内部启用垂直滚动
          padding: '6px',
          paddingBottom: "100px", // 保留您的逻辑，防止内容被底部栏遮挡
          transition: 'padding-bottom 0.3s',
          scrollbarWidth: 'none', // 使滚动条更细
        }}
      >
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/playlist" element={<PlaylistPage />} />
          <Route path="/player" element={<PlayerPage audioRef={audioRef} />} />
          <Route path="/setting" element={<SettingPage />} />
          <Route path="/setting/about" element={<AboutPage />} />
          <Route path="/setting/privacy" element={<PrivacyPage />} />
          <Route path="/setting/cache" element={<CacheManagePage />} />
          <Route path="/setting/cache/playlist/:playlistId" element={<PlaylistCacheManagePage />} />
        </Routes>
      </Content>

      {/* 3. 播放器和导航栏是固定定位的，它们会浮在 Content 之上 */}
      <FloatPlayer
        key={currentMusic?.cover_url}
        currentMusic={currentMusic}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        visible={location.pathname !== '/player'}
      />
      <audio ref={audioRef} onEnded={handleNext} style={{ display: "none" }} />
      <BottomNav />
    </Layout>
  );
}

const App = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
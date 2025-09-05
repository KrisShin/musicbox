import { useEffect, useRef, useState } from 'react';
import { Layout, Typography, Image, Flex, Button } from 'antd';
import SearchPage from './pages/Search';
import PlaylistPage from './pages/Playlist';
import PlayerPage from './pages/Player';
import SettingPage from './pages/Setting';
import BottomNav from './components/BottomNav';
import './App.css';
import { useAppStore } from './store';
import { Content } from 'antd/es/layout/layout';
import FloatPlayer from './components/FloatPlayer';
import { useGlobalMessage, useGlobalModal } from './components/MessageHook';
import { UpdateInfo } from './types';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

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
const App = () => {
  const [activeTab, setActiveTab] = useState('search');
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

  const renderContent = () => {
    switch (activeTab) {
      case 'search':
        return <SearchPage />;
      case 'playlist':
        return <PlaylistPage />;
      case 'player':
        return <PlayerPage audioRef={audioRef} />;
      case 'setting':
        return <SettingPage />;
      default:
        return <SearchPage />;
    }
  };


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMusic?.file_path) {
      handleClose(); // 如果没有播放链接，就关闭播放器
      return;
    };

    if (audio.src !== currentMusic.file_path) {
      audio.src = currentMusic.file_path;
      if (isPlaying && !audio.played) {
        audio.play().catch(e => console.error("自动播放失败:", e));
      }
    }
  }, [currentMusic, handleNext]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const result: UpdateInfo = await invoke('check_for_updates');

        if (result.update_available) {

          // 2. 捕获 modal 实例，以便手动关闭
          let modalInstance: any = null;

          // 定义各个按钮的点击事件处理函数
          const handleGoNow = async () => {
            const downloadUrl = result?.download_url;
            if (downloadUrl) {
              await copy2Clipboard()
              try {
                const newWindow = open(downloadUrl);
                if (!newWindow) {
                  messageApi.error("无法打开新窗口，可能被浏览器拦截了。");
                }
              } catch (err) {
                console.error("无法打开下载链接:", err);
                messageApi.error("无法打开下载链接，请手动复制。");
              }
            } else {
              messageApi.error("下载链接无效！");
            }
            modalInstance?.destroy(); // 关闭弹窗
          };

          const handleIgnoreVersion = () => {
            invoke('ignore_update', { version: result.version })
              .then(() => messageApi.info(`已忽略版本 v${result.version}，不再提醒。`))
              .catch(err => console.error("忽略版本失败:", err));
            modalInstance?.destroy(); // 关闭弹窗
          };

          const handleRemindLater = () => {
            modalInstance?.destroy(); // 只关闭弹窗，不做任何事
          };

          const copy2Clipboard = async () => {
            try {
              await writeText(result.download_password!);
              messageApi.success('密码已复制到剪贴板！');
            } catch (err) {
              console.error('复制失败:', err);
              messageApi.error('复制失败，请手动复制。');
            }
          }

          // 3. 使用 modal 实例，并传入自定义 footer
          modalInstance = modalApi.confirm({
            title: `发现新版本 v${result.version}`,
            // content 部分保持不变
            content: (
              <div>
                <p>有新的更新可用，是否立即下载？</p>
                <p><strong>更新日志:</strong></p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{result.notes}</p>
                {result.download_password && (
                  <p>
                    <strong>下载密码: </strong>
                    <span
                      onClick={copy2Clipboard}
                      style={{ color: "#F08080", cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                    >
                      {result.download_password}
                    </span>
                  </p>
                )}
              </div>
            ),
            // 4. 移除 okText, cancelText, onOk, onCancel，使用 footer 完全接管
            footer: (
              <Flex justify='end' gap="small" style={{ marginTop: '16px' }}>
                <Button type='text' onClick={handleIgnoreVersion}>忽略此版本</Button>
                <Button onClick={handleRemindLater}>下次再说</Button>
                <Button type="primary" onClick={handleGoNow}>
                  立即前往
                </Button>
              </Flex>
            ),
          });
        } else {
          console.log("检查更新：当前已是最新版本或新版本已被忽略。");
        }
      } catch (error) {
        console.error("检查更新失败:", error);
      }
    };

    const timer = setTimeout(checkForUpdates, 1000);
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
        {renderContent()}
      </Content>

      {/* 3. 播放器和导航栏是固定定位的，它们会浮在 Content 之上 */}
      <FloatPlayer
        key={currentMusic?.cover_url}
        currentMusic={currentMusic}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        visible={activeTab !== 'player'}
      />
      <audio ref={audioRef} onEnded={handleNext} style={{ display: "none" }} />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </Layout>
  );
}

export default App;
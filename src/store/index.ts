import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { Music } from "../types";
import { musicDetail, searchMusic } from "../util/crawler";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// 1. 在内存中创建一个缓存，用于存储最后一次保存到数据库的 *字符串值*
let lastSavedValue: string | null = null;

// 2. 定义与后端交互的自定义存储引擎 (实现 StateStorage 接口)
// StateStorage 只处理原始字符串，这让我们得以绕过所有复杂的泛型类型问题
const tauriStorage: StateStorage = {
  setItem: async (name: string, value: string): Promise<void> => {
    if (value !== lastSavedValue) {
      console.log("Persist: 持久化状态已更改, 正在保存到后端...");
      await invoke("save_app_setting", { key: name, value });
      lastSavedValue = value; // 写入成功后，更新内存缓存
    }
  },
  getItem: async (name: string): Promise<string | null> => {
    // 从后端加载时，同时设置内存缓存，以便进行首次比较
    console.log("Persist: 正在从后端加载状态...");
    const value = await invoke<string | null>("get_app_setting", { key: name });
    lastSavedValue = value; // 初始化缓存
    return value;
  },
  removeItem: async (name: string): Promise<void> => {
    await invoke("save_app_setting", { key: name, value: "" });
    lastSavedValue = null;
  },
};

export type PlayMode = "sequence" | "single" | "shuffle";

// 2. 定义 store 的 state 和 actions 的类型
interface AppState {
  // 搜索状态
  loading: boolean;
  searched: boolean;
  musicList: Music[];
  currentKeyword: string;
  page: number;
  hasMore: boolean;

  // 播放状态
  playQueue: Music[];
  currentMusic: Music | null;
  isPlaying: boolean;
  playingMusicIndex: number;
  playMode: PlayMode; // [新增] 播放模式
  currentTime: number;
  duration: number;

  // Actions
  handleSearch: (value: string) => Promise<void>;
  handleDetail: (music: Music) => Promise<Music>;
  startPlayback: (songs: Music[], startIndex: number) => Promise<void>;
  handlePlayPause: () => void;
  _playIndexMusic: (index: number) => void;
  handleNext: () => void;
  handlePrev: () => void;
  handleSave: (musicList: Music[]) => Promise<string>;
  handleClose: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  cyclePlayMode: (mode?: PlayMode) => Promise<string>; // [新增] 切换播放模式
  saveSongWithNotifications: (music: Music) => Promise<string>; // 下载时发送通知
}

// 3. 创建 Zustand store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- 初始 State ---
      loading: false,
      searched: false,
      musicList: [],
      currentKeyword: "热门",
      page: 1,
      hasMore: false,

      playQueue: [],
      currentMusic: null,
      playMode: "sequence", // 默认播放模式为顺序播放
      playingMusicIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,

      // --- Actions ---
      handleSearch: async (value) => {
        const keyword = value.trim();
        if (!keyword) return;

        const { page, currentKeyword, musicList } = get();

        set({ loading: true, searched: true });
        let currentPage = 1;
        if (keyword != currentKeyword) {
          set({ currentKeyword: keyword });
        } else {
          currentPage = page + 1;
        }
        try {
          const result = await searchMusic(keyword);
          if (result.music_list.length === 0) {
            set({ hasMore: false, loading: false });
            throw new Error("404");
          }
          keyword == currentKeyword
            ? set({ musicList: musicList.concat(result.music_list) })
            : set({ musicList: result.music_list });
          set({ hasMore: result.has_more, page: currentPage });
        } catch (error: any) {
          throw error;
        } finally {
          set({ loading: false, searched: false });
        }
      },
      handleDetail: async (music: Music) => {
        try {
          const result = await musicDetail(music);
          return result;
        } catch (error) {
          throw error;
        }
      },

      handlePlayPause: () => {
        set((state) => ({ isPlaying: !state.isPlaying }));
      },

      startPlayback: async (musicList, startIndex) => {
        if (!musicList || musicList.length === 0) return;

        // 1. 设置播放队列
        set({ playQueue: musicList, playingMusicIndex: startIndex });

        // 2. 获取歌曲详情并开始播放
        const musicToPlay = musicList[startIndex];
        try {
          await get()
            .handleDetail(musicToPlay)
            .then((music: Music) => {
              set({ isPlaying: true, currentMusic: music });
            });
        } catch (error) {
          throw new Error("获取歌曲详情失败");
        }
      },

      _playIndexMusic: (index) => {
        const { playQueue, handleDetail, startPlayback, handleClose } = get();
        if (index < 0 || index >= playQueue.length) {
          handleClose();
          return;
        }
        handleDetail(playQueue[index]);
        startPlayback(playQueue, index);
      },
      handleSave: async (musicList: Music[]) => {
        try {
          const musicIds = [];
          for (const music of musicList) {
            if (!music.file_path) {
              await get().handleDetail(music);
            }
            musicIds.push(music.song_id);
          }
          console.log({ type: "info", content: "正在获取歌曲信息..." });
          const resultMsg = await invoke<string>("export_music_file", {
            musicIds: musicIds,
          });

          console.log(resultMsg);
          return resultMsg;
        } catch (error: any) {
          console.error("保存文件失败:", error);
          console.log({
            type: "error",
            content: `保存失败: ${error.toString()}`,
          });
          throw new Error(error);
        }
      },
      handleNext: () => {
        const { playMode, playingMusicIndex, playQueue, _playIndexMusic } =
          get();
        if (playQueue.length === 0) return;

        let nextIndex = playingMusicIndex;
        switch (playMode) {
          case "single":
            // 单曲循环：重新播放当前歌曲
            _playIndexMusic(playingMusicIndex);
            return;
          case "shuffle":
            // 随机播放：获取一个随机索引
            if (playQueue.length <= 1) break; // 如果只有一首歌，直接返回
            let newIndex = Math.floor(Math.random() * playQueue.length);
            while (newIndex === nextIndex) {
              newIndex = Math.floor(Math.random() * playQueue.length);
            }
            nextIndex = newIndex;
            break;
          case "sequence":
          default:
            // 顺序播放
            nextIndex = playingMusicIndex + 1;
            // 如果是最后一首，则循环到第一首
            if (nextIndex >= playQueue.length) {
              nextIndex = 0;
            }
            break;
        }
        console.log(
          "当前音乐",
          playQueue[playingMusicIndex].title,
          "下一首音乐",
          playQueue[nextIndex].title,
          "播放模式",
          playMode
        );
        _playIndexMusic(nextIndex);
      },
      handlePrev: () => {
        const { playingMusicIndex, playQueue, _playIndexMusic } = get();
        if (playQueue.length <= 1) return;
        let prevIndex = playingMusicIndex - 1;
        if (prevIndex < 0) {
          prevIndex = playQueue.length - 1; // 循环到最后一首
        }
        _playIndexMusic(prevIndex);
      },
      handleClose: () => {
        set({
          currentMusic: null,
          isPlaying: false,
          playingMusicIndex: -1,
          playQueue: [],
        });
      },
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration: duration }),
      cyclePlayMode: async (mode?: PlayMode) => {
        const { playMode } = get();
        if (mode && playMode.includes(mode)) {
          set({ playMode: mode });
          return mode;
        }
        const modes: PlayMode[] = ["sequence", "single", "shuffle"];
        const currentIndex = modes.indexOf(playMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        set({ playMode: modes[nextIndex] });
        return modes[nextIndex]; // 返回新的播放模式
      },
      saveSongWithNotifications: async (music?: Music) => {
        const { handleSave, currentMusic } = get();
        if (!music) {
          if (!currentMusic) throw new Error("未选中歌曲, 无法下载");
          music = currentMusic;
        }
        try {
          // 1. 检查并请求权限 (一次授权，终身使用)
          let hasPermission = await isPermissionGranted();
          if (!hasPermission) {
            const permissionResult = await requestPermission();
            hasPermission = permissionResult === "granted";
          }

          // 2. 如果有权限，发送“开始缓存”通知
          if (hasPermission) {
            sendNotification({
              title: "开始缓存",
              body: `正在将《${music.title}》保存到本地...`,
              // 你还可以添加一个图标
              // icon: 'path/to/icon.png'
            });
          }

          // 3. 执行核心的缓存操作
          const file_path = await handleSave([music]);

          // 4. 缓存成功后，发送“完成”通知
          if (hasPermission) {
            sendNotification({
              title: "缓存完成 🎉",
              body: `歌曲《${music.title}》已成功保存到本地！`,
            });
          }
          return file_path;
        } catch (error) {
          console.error(`缓存歌曲《${music.title}》时出错:`, error);

          // 5. (可选) 如果失败，也可以发送一个失败通知
          const hasPermission = await isPermissionGranted();
          if (hasPermission) {
            sendNotification({
              title: "缓存失败 😥",
              body: `无法缓存歌曲《${music.title}》，请检查网络或稍后重试。`,
            });
          }
          throw new Error(`${error}`);
        }
      },
    }),
    {
      name: "frontend-cache", // [核心修复] persist 中间件会自动使用 createJSONStorage 来包装我们提供的原始 tauriStorage // 这解决了所有的类型冲突
      storage: createJSONStorage(() => tauriStorage), // [关键] partialize 保持不变
      partialize: (state) => ({
        currentMusic: state.currentMusic,
        playingMusicIndex: state.playingMusicIndex,
        musicList: state.musicList,
        currentKeyword: state.currentKeyword,
        playQueue: state.playQueue,
        playMode: state.playMode,
      }),
    }
  )
);

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { Music } from "../types";
import { musicDetail, searchMusic } from "../util/crawler";
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { save } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";

// 1. 定义与后端交互的自定义存储引擎
const tauriStorage = {
  setItem: async (name: string, value: string): Promise<void> => {
    // `name` 就是我们 persist 中定义的名字 'frontend-cache'
    await invoke("save_app_setting", { key: name, value });
  },
  getItem: async (name: string): Promise<string | null> => {
    return await invoke("get_app_setting", { key: name });
  },
  removeItem: async (name: string): Promise<void> => {
    // 也可以实现一个删除的 command，这里我们先用保存空字符串代替
    await invoke("save_app_setting", { key: name, value: "" });
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
  handleDetail: (music: Music) => Promise<void>;
  startPlayback: (songs: Music[], startIndex: number) => Promise<void>;
  handlePlayPause: () => void;
  _playIndexMusic: (index: number) => void;
  handleNext: () => void;
  handlePrev: () => void;
  handleSave: (music: Music) => Promise<string>;
  handleClose: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  cyclePlayMode: (mode?: PlayMode) => Promise<string>; // [新增] 切换播放模式
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
          set({ currentMusic: result });
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
            .then(() => {
              set({ isPlaying: true });
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
      handleSave: async (music: Music) => {
        try {
          // 首先，确保我们有最新的、包含 play_url 的音乐详情
          const musicWithDetail = await musicDetail(music);
          if (!musicWithDetail.play_url) {
            throw new Error("未能获取有效的播放链接");
          }

          const currentPlatform = platform();
          const isMobile =
            currentPlatform === "android" || currentPlatform === "ios";

          // --- 桌面端逻辑 ---
          if (!isMobile) {
            console.log("(下载) 桌面端平台，调用后台静默下载...");
            const savePath = await invoke<string>("download_music_desktop", {
              url: musicWithDetail.play_url,
              title: musicWithDetail.title,
              artist: musicWithDetail.artist,
            });
            console.log(`(下载) 桌面端下载成功，路径: ${savePath}`);
            return savePath; // 返回保存路径
          }

          // --- 移动端逻辑 ---
          else {
            console.log("(下载) 移动端平台，弹出保存对话框...");
            const suggestedFilename = `${musicWithDetail.title} - ${musicWithDetail.artist}.mp3`;

            // 弹出保存对话框，让用户选择位置
            // filePath 是一个带授权的 content:// URI
            const filePath = await save({
              title: "保存到...",
              defaultPath: `Download/${suggestedFilename}`, // 为用户提供一个友好的默认文件名
            });

            // 如果用户取消了选择，filePath 会是 null
            if (!filePath) {
              console.log("(下载) 用户取消保存。");
              throw new Error(`取消下载`);
            }

            console.log(`(下载) 用户选择了路径，开始下载: ${filePath}`);

            // 使用 tauriFetch 下载文件内容
            const response = await tauriFetch(musicWithDetail.play_url, {
              method: "GET",
            });
            if (!response.ok)
              throw new Error(`HTTP 请求失败: ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();

            // 使用 writeFile 写入到用户刚刚授权的 content:// URI
            await writeFile(filePath, new Uint8Array(arrayBuffer));

            console.log("(下载) 移动端下载成功！");
            return filePath;
          }
        } catch (error: any) {
          console.error("下载失败:", error);
          throw new Error(`${error}`);
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
    }),
    {
      // 4. 配置 persist 中间件
      name: "frontend-cache", // 这将是我们在数据库中存储的 key
      storage: createJSONStorage(() => tauriStorage), // 使用我们自定义的 Tauri 存储引擎

      // 5. [关键] 选择性持久化：只保存我们需要的状态
      partialize: (state) => ({
        currentMusic: state.currentMusic,
        playingMusicIndex: state.playingMusicIndex,
        musicList: state.musicList, // 例如，保存上次的搜索列表
        currentKeyword: state.currentKeyword,
        playQueue: state.playQueue,
        playMode: state.playMode,
      }),
    }
  )
);

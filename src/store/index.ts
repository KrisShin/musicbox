import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { Music } from '../types';
import { musicDetail, searchMusic } from '../crawler';
import { downloadDir } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { writeFile } from '@tauri-apps/plugin-fs';


// 1. 定义与后端交互的自定义存储引擎
const tauriStorage = {
  setItem: async (name: string, value: string): Promise<void> => {
    // `name` 就是我们 persist 中定义的名字 'frontend-cache'
    await invoke('save_app_setting', { key: name, value });
  },
  getItem: async (name: string): Promise<string | null> => {
    return await invoke('get_app_setting', { key: name });
  },
  removeItem: async (name: string): Promise<void> => {
    // 也可以实现一个删除的 command，这里我们先用保存空字符串代替
    await invoke('save_app_setting', { key: name, value: '' });
  },
};

// 2. 定义 store 的 state 和 actions 的类型
interface AppState {
  // State
  loading: boolean;
  searched: boolean;
  musicList: Music[];
  currentKeyword: string;
  page: number;
  hasMore: boolean;
  playingMusicIndex: number;
  currentMusic: Music | null;
  isPlaying: boolean;
  // Actions
  handleSearch: (value: string) => Promise<void>;
  handleDetail: (music: Music, index: number) => Promise<void>;
  handlePlayPause: () => void;
  _playIndexMusic: (index: number) => void;
  handleNext: () => void;
  handlePrev: () => void;
  handleSave: () => void;
  handleClose: () => void;
}

// 3. 创建 Zustand store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- 初始 State ---
      loading: false,
      searched: false,
      musicList: [],
      currentKeyword: '热门',
      page: 1,
      hasMore: false,
      playingMusicIndex: -1,
      currentMusic: null,
      isPlaying: false,
      // --- Actions ---
      handleSearch: async (value) => {
        const keyword = value.trim();
        if (!keyword) return;

        const { page, currentKeyword, musicList } = get()

        set({ loading: true, searched: true })
        let currentPage = 1;
        if (keyword != currentKeyword) {
          set({ currentKeyword: keyword })
        } else {
          currentPage = page + 1;
        }
        try {
          const result = await searchMusic(keyword, currentPage);
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
      handleDetail: async (music, index) => {
        set({ playingMusicIndex: index });
        try {
          const result = await musicDetail(music);
          set({ currentMusic: result, isPlaying: true });
        } catch (error) {
          throw error;
        }
      },
      handlePlayPause: () => {
        set((state) => ({ isPlaying: !state.isPlaying }));
      },
      _playIndexMusic: (index) => {
        const { musicList, handleDetail, handleClose } = get();
        if (index < 0 || index >= musicList.length) {
          handleClose();
          return;
        }
        handleDetail(musicList[index], index);
      },
      handleSave: async () => {
        const music = get().currentMusic;
        try {
          if (!music?.play_url) throw new Error("未能获取下载链接");
          const suggestedFilename = `${music.title} - ${music.artist}.mp3`;
          const defaultPath = await downloadDir();
          const filePath = await save({
            title: "选择保存位置",
            defaultPath: `${defaultPath}/${suggestedFilename}`,
            filters: [{ name: "MP3 Audio", extensions: ["mp3"] }],
          });
          if (!filePath) {
            return;
          }
          const response = await tauriFetch(music.play_url, {
            method: "GET",
            headers: {
              Referer: `https://www.gequhai.net${music.url}`,
            },
          });
          if (!response.ok) {
            throw new Error(`下载请求失败，状态: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await writeFile(filePath, uint8Array);
        } catch (error: any) {
          throw new Error(`下载失败: ${error.message || "未知错误"}`)
        }
      },

      handleNext: () => get()._playIndexMusic(get().playingMusicIndex + 1),
      handlePrev: () => get()._playIndexMusic(get().playingMusicIndex - 1),


      handleClose: () => {
        set({ currentMusic: null, isPlaying: false, playingMusicIndex: -1 });
      },
    }),
    {
      // 4. 配置 persist 中间件
      name: 'frontend-cache', // 这将是我们在数据库中存储的 key
      storage: createJSONStorage(() => tauriStorage), // 使用我们自定义的 Tauri 存储引擎

      // 5. [关键] 选择性持久化：只保存我们需要的状态
      partialize: (state) => ({
        currentMusic: state.currentMusic,
        playingMusicIndex: state.playingMusicIndex,
        musicList: state.musicList, // 例如，保存上次的搜索列表
        currentKeyword: state.currentKeyword,
      }),
    }
  )
);
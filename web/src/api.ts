import axios from "axios";
import type { Song, SearchResult, SongDetail } from "./types"; // 假设你的类型定义在 types.ts

// 1. 创建一个 Axios 实例
//    我们在这里配置了 API 的基础 URL，这样就不用在每个请求里都写 'http://localhost:8000' 了。
const apiClient = axios.create({
  baseURL: "http://localhost:8000", // 你的 FastAPI 后端地址
  timeout: 10000, // 设置10秒的请求超时
  headers: {
    "Content-Type": "application/json",
  },
});

// 2. 封装搜索音乐的 API 调用
export const searchMusicApi = async (
  keyword: string,
  page: number = 1
): Promise<SearchResult> => {
  try {
    const response = await apiClient.post<Song[], any>("/search/", {
      keyword,
      page,
    });
    // 假设后端直接返回歌曲数组，我们在这里包装成 SearchResult 格式
    // 如果后端已经返回 { songs: [...], has_more: ... } 格式，直接 return response.data 即可
    return {
      songs: response.data.data,
      has_more: response.data.has_more, // 简单判断，可以根据后端返回值修改
    };
  } catch (error) {
    console.error("搜索 API 调用失败:", error);
    // 抛出错误，让组件层可以捕获并显示给用户
    throw new Error("搜索失败，请稍后再试");
  }
};

// 3. 封装获取歌曲详情的 API 调用 (我们将在播放或下载时使用)
// 假设后端的详情接口需要这些参数
export interface SongDetailsParams {
  url: string;
}

export const getMusicDetailsApi = async (
  params: SongDetailsParams
): Promise<SongDetail> => {
  try {
    const response = await apiClient.post<SongDetail>(
      "/detail/",
      params
    );
    return response.data;
  } catch (error) {
    console.error("获取详情 API 调用失败:", error);
    throw new Error("获取歌曲详情失败");
  }
};

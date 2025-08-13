// src/crawler.ts (或你的API文件)

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { invoke } from '@tauri-apps/api/core';
import { Muisc, SearchResult } from "./types"; // 确保类型定义正确

const parser = new DOMParser();

const BASE_URL = "https://www.gequhai.net"; // 基础URL

export const searchMusic = async (
  keyword: string,
  page: number = 1
): Promise<SearchResult> => {
  // 1. 更新为 gequhai.net 的 URL 结构
  const searchUrl = `${BASE_URL}/s/${keyword}?page=${page}`;

  try {
    const response = await tauriFetch(searchUrl, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`请求搜索页失败: ${response.status}`);
    }

    const htmlText = await response.text();
    const doc = parser.parseFromString(htmlText, "text/html");

    // 2. 核心修改：使用新的、更健壮的选择器
    // 直接选取所有包含歌曲信息的 <a> 标签
    const linkElements = doc.querySelectorAll("a.music-link");

    const musicList: Muisc[] = [];

    linkElements.forEach((link) => {
      const title = link.querySelector("span.music-title > span")?.textContent;
      const artist = link.querySelector("small.text-jade")?.textContent;
      const detailUrl = link.getAttribute("href"); // e.g., /search_music?song_id=...&...

      if (title && artist && detailUrl) {
        try {
          // 3. 使用 URLSearchParams 安全地解析 song_id
          // 它可以处理复杂的URL参数，比 split 更可靠
          const urlParams = new URLSearchParams(detailUrl.split("?")[1]);
          const songId = urlParams.get("song_id");

          if (songId) {
            musicList.push({
              song_id: songId,
              title: title.trim(),
              artist: artist.trim(),
              // 我们需要保存完整的详情页URL，以便后续的详情请求
              url: detailUrl,
            });
          }
        } catch (e) {
          console.error("从URL解析song_id失败:", detailUrl, e);
        }
      }
    });

    // 4. 分页逻辑 (与之前相同，因为分页组件结构类似)
    const lastPageItem = doc.querySelector(
      "ul.pagination li.page-item:last-child"
    );
    let hasMore = true;
    // 如果最后一个分页项存在，并且它包含 'disabled' 类，则说明没有下一页了
    if (lastPageItem?.classList.contains("disabled") || !lastPageItem) {
      hasMore = false;
    }
    if (musicList && musicList.length > 0) {
      try {
        await invoke('save_music', { music_list: musicList }); // 'save_music' 必须与 Rust command 的函数名完全一致
        console.log('成功将', musicList.length, '首歌曲保存到本地数据库！');
      } catch (error) {
        console.error('调用 save_music 失败:', error);
      }
    }

    return {
      music_list: musicList,
      has_more: hasMore,
    };
  } catch (error) {
    console.error("前端爬虫搜索失败:", error);
    throw error;
  }
};

export const musicDetail = async (music: Muisc): Promise<Muisc> => {
  const fullDetailUrl = `${BASE_URL}${music.url}`;

  try {
    // 步骤 1: 获取详情页的HTML文本
    console.log(`(前端爬虫) 步骤1: 正在访问详情页 -> ${fullDetailUrl}`);
    const response = await tauriFetch(fullDetailUrl, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`请求详情页失败: ${response.status}`);
    }

    const htmlText = (await response.text()) as string;
    const doc = parser.parseFromString(htmlText, "text/html");

    // 步骤 2: 从HTML中解析静态信息和动态ID
    console.log("(前端爬虫) 步骤2: 正在解析页面内容...");

    // 提取封面
    const cover_url = doc.querySelector<HTMLMetaElement>(
      'meta[property="og:image"]'
    )?.content;

    // 提取歌词
    const lyricElement = doc.getElementById("content-lrc");
    const lyric = lyricElement
      ? lyricElement.innerHTML.replace(/<br\s*\/?>/gi, "\n")
      : "";

    // 使用正则表达式从整个HTML文本中提取动态信息
    // const durationMatch = htmlText.match(
    //   /ap\.template\.dtime\.innerHTML = '.*?(\d{2}:\d{2}).*?';/
    // );
    // let duration: any = durationMatch ? durationMatch[1] : "00:00";
    

    const mp3IdMatch = htmlText.match(/window\.mp3_id = '(.*?)';/);
    if (!mp3IdMatch || !mp3IdMatch[1]) {
      throw new Error("在详情页中未能解析出 mp3_id");
    }
    const download_mp3_id = mp3IdMatch[1];

    const playIdMatch = htmlText.match(/window\.play_id = '(.*?)';/);
    if (!playIdMatch || !playIdMatch[1]) {
      throw new Error("在详情页中未能解析出 play_id");
    }
    const playId = playIdMatch[1];
    console.log(`(前端爬虫) 提取到 play_id -> ${playId}`);

    // 步骤 3: 模拟页面JS，POST请求 /api/play-url
    console.log(`(前端爬虫) 步骤3: 携带 play_id 请求 /api/play-url`);
    const apiUrl = `${BASE_URL}/api/play-url`;

    const apiResponse = await tauriFetch(apiUrl, {
      method: "POST",
      // 发送 form-data, Content-Type 会由插件自动设置
      body: `id=${playId}`,
      headers: {
        // 关键：必须带上正确的 Referer
        Referer: fullDetailUrl,
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`请求播放API失败: ${apiResponse.status}`);
    }

    const apiData = (await apiResponse.json()) as any;

    // 步骤 4: 从API响应中提取最终的播放/下载链接
    if (apiData?.code !== 1 || !apiData?.data?.url) {
      throw new Error(apiData.msg || "播放API未返回有效的URL");
    }

    const play_url = apiData.data.url;
    console.log(`(前端爬虫) 步骤4: 成功获取到直链 -> ${play_url}`);

    const updatedMusic: Muisc = {
      ...music,
      cover_url,
      lyric,
      // duration,
      download_mp3_id,
      download_mp3: `${BASE_URL}/api/down_mp3/${download_mp3_id}`,
      download_kuake: `${BASE_URL}/api/down_url/${download_mp3_id}`,
      play_url,
    };

    try {
      // 构建与 Rust `UpdateDetailPayload` 完全匹配的对象
      const payload = {
        song_id: updatedMusic.song_id,
        // 所有详情字段直接放在顶层，因为 Rust 端有 #[serde(flatten)]
        lyric: updatedMusic.lyric,
        cover_url: updatedMusic.cover_url,
        play_url: updatedMusic.play_url,
        download_mp3: updatedMusic.download_mp3,
        download_kuake: updatedMusic.download_kuake,
        download_mp3_id: updatedMusic.download_mp3_id,
      };
      // 注意 invoke 的第二个参数结构
      await invoke('update_music_detail', { payload: payload });
      console.log(`(后端交互) 成功更新歌曲详情到数据库: ${updatedMusic.title}`);
    } catch (dbError) {
      console.error('调用 update_music_detail 失败:', dbError);
    }

    return updatedMusic;
  } catch (error) {
    console.error("获取歌曲详情失败:", error);
    throw error;
  }
};

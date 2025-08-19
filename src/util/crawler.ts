// src/crawler.ts (或你的API文件)

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { invoke } from '@tauri-apps/api/core';
import { Music, SearchResult } from "../types"; // 确保类型定义正确

const parser = new DOMParser();

// export const BASE_URL = "https://www.gequhai.net"; // 基础URL
export const BASE_URL = "https://www.gequbao.com"; // 基础URL

/**
 * [重构后] 根据关键词搜索音乐
 * @param keyword 搜索关键词
 * @param page 页码
 * @returns Promise<SearchResult>
 */
export const searchMusic = async (
  keyword: string,
): Promise<SearchResult> => {
  const searchUrl = `${BASE_URL}/s/${encodeURIComponent(keyword)}`;

  try {
    const response = await tauriFetch(searchUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`请求搜索页失败: ${response.status}`);
    }

    const htmlText = await response.text() as string;
    const doc = parser.parseFromString(htmlText, 'text/html');

    // 2. [核心修改] 使用新的、更健壮的选择器
    // 直接选取所有包含歌曲信息的 <a> 标签，它的 class="music-link" 非常独特
    const linkElements = doc.querySelectorAll('a.music-link');

    const musicList: Music[] = [];

    linkElements.forEach((link) => {
      // 3. 使用更精确的选择器分别获取标题和艺术家
      const title = link.querySelector('span.music-title > span')?.textContent;
      const artist = link.querySelector('small.text-jade')?.textContent;
      const detailUrl = link.getAttribute('href'); // 例如: /music/4188

      if (title && artist && detailUrl) {
        // 4. [核心修改] 从 URL 中提取 song_id，新方式更简单可靠
        // 通过分割字符串 "/music/" 来获取后面的 ID 部分
        const songId = detailUrl.split('/music/')[1];

        if (songId) {
          musicList.push({
            song_id: songId,
            title: title.trim(),
            artist: artist.trim(),
            // 保存相对 URL，后续拼接成完整链接
            url: detailUrl,
          });
        }
      }
    });

    const hasMore = false // musicList.length > 0;

    // 6. 保存到数据库的逻辑保持不变，依然健壮
    if (musicList.length > 0) {
      try {
        await invoke('save_music', { musicList }); // 'save_music' 必须与 Rust command 的函数名完全一致
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
    console.error('前端爬虫搜索失败:', error);
    throw error; // 将错误继续向上抛出，让 UI 层可以捕获并显示
  }
};

export const musicDetail = async (music: Music): Promise<Music> => {
  const fullDetailUrl = `${BASE_URL}${music.url}`;

  try {
    // 步骤 1: 获取详情页 HTML
    const response = await tauriFetch(fullDetailUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`请求详情页失败: ${response.status}`);
    }
    const htmlText = await response.text() as string;

    // 步骤 2: [核心修改] 使用正则表达式从 HTML 中提取 window.appData
    const appDataMatch = htmlText.match(/window\.appData = (.*?);/);
    if (!appDataMatch || !appDataMatch[1]) {
      throw new Error("在详情页中未能解析出 appData");
    }
    const appData = JSON.parse(appDataMatch[1]);

    // 从 appData 中提取关键信息
    const playId = appData.play_id;
    const mp3Id = appData.mp3_id.toString();
    const extraUrls = appData?.mp3_extra_urls;

    if (!playId || !mp3Id) {
      throw new Error("appData 中缺少 play_id 或 mp3_id");
    }

    // 步骤 3: 使用 DOMParser 解析静态信息（作为备用和补充）
    const doc = parser.parseFromString(htmlText, "text/html");
    const cover_url = doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
    const lyric = doc.getElementById("content-lrc")?.innerHTML.replace(/<br\s*\/?>/gi, "\n") || "";

    // 步骤 4: 请求播放 API
    const apiUrl = `${BASE_URL}/api/play-url`;

    const apiResponse = await tauriFetch(apiUrl, {
      method: "POST",
      body: `id=${playId}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': BASE_URL,
        'Referer': fullDetailUrl,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`请求播放API失败: ${apiResponse.status}`);
    }
    const apiData = await apiResponse.json() as any;
    if (apiData?.code !== 1 || !apiData?.data?.url) {
      throw new Error(apiData.msg || "播放API未返回有效的URL");
    }
    const play_url = apiData.data.url;

    // 步骤 5: 组装最终的 Music 对象
    const updatedMusic: Music = {
      ...music,
      cover_url: cover_url || appData.mp3_cover, // 优先使用 og:image，备用 appData 的
      lyric,
      download_mp3_id: mp3Id,
      play_url,
      download_mp3: play_url,
      download_extra: extraUrls && extraUrls.length > 0 ? extraUrls[0].share_link : undefined,
    };

    // 步骤 6: [新] 调用后端更新数据库
    try {
      const payload = {
        song_id: updatedMusic.song_id,
        lyric: updatedMusic.lyric,
        cover_url: updatedMusic?.cover_url?.replace('http://', 'https://'),
        duration_secs: updatedMusic.duration,
        play_url: updatedMusic.play_url,
        download_mp3: updatedMusic.download_mp3,
        download_extra: updatedMusic.download_extra, // 使用新字段名
        download_mp3_id: updatedMusic.download_mp3_id,
      };
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
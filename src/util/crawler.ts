// src/crawler.ts (或你的API文件)

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
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
export const searchMusic = async (keyword: string): Promise<SearchResult> => {
  const searchUrl = `${BASE_URL}/s/${encodeURIComponent(keyword)}`;

  try {
    const response = await tauriFetch(searchUrl, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`请求搜索页失败: ${response.status}`);
    }

    const htmlText = (await response.text()) as string;
    const doc = parser.parseFromString(htmlText, "text/html");

    // 2. [核心修改] 使用新的、更健壮的选择器
    // 直接选取所有包含歌曲信息的 <a> 标签，它的 class="music-link" 非常独特
    const linkElements = doc.querySelectorAll("a.music-link");

    const musicList: Music[] = [];

    linkElements.forEach((link) => {
      // 3. 使用更精确的选择器分别获取标题和艺术家
      const title = link.querySelector("span.music-title > span")?.textContent;
      const artist = link.querySelector("small.text-jade")?.textContent;
      const detailUrl = link.getAttribute("href"); // 例如: /music/4188

      if (title && artist && detailUrl) {
        // 4. [核心修改] 从 URL 中提取 song_id，新方式更简单可靠
        // 通过分割字符串 "/music/" 来获取后面的 ID 部分
        const songId = detailUrl.split("/music/")[1];

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

    const hasMore = false; // musicList.length > 0;

    // 6. 保存到数据库的逻辑保持不变，依然健壮
    if (musicList.length > 0) {
      try {
        await invoke("save_music", { musicList }); // 'save_music' 必须与 Rust command 的函数名完全一致
        console.log("成功将", musicList.length, "首歌曲保存到本地数据库！");
      } catch (error) {
        console.error("调用 save_music 失败:", error);
      }
    }

    return {
      music_list: musicList,
      has_more: hasMore,
    };
  } catch (error) {
    console.error("前端爬虫搜索失败:", error);
    throw error; // 将错误继续向上抛出，让 UI 层可以捕获并显示
  }
};

export const musicDetail = async (music: Music): Promise<Music> => {
  try {
    const fullDetailUrl = `${BASE_URL}${music.url}`;
    const dbMusic = await invoke<Music[]>("get_music_list_by_ids", {
      songIds: [music.song_id],
    }).then((res) => (res ? res[0] : null));

    if (dbMusic && dbMusic.play_id && dbMusic.file_path) {
      console.log(`(DB) 已有详情，直接返回: ${music.title}`);
      return {
        ...dbMusic,
        file_path: dbMusic.file_path.split("music_cache").pop(),
      };
    }

    console.log(`(Crawler) 数据库无详情，开始爬取: ${music.title}`);
    music = await fetchMusicDetailInfo(music, fullDetailUrl);

    const play_url = await fetchMusicPlayUrl(music, fullDetailUrl);

    const payload = {
      ...music,
      play_url: play_url,
      download_mp3: play_url,
    };

    // 调用后端更新数据库
    await invoke("update_music_detail", { payload: payload });
    const file_path = await invoke<string | undefined>(
      "cache_music_and_get_file_path",
      { music: payload }
    );
    console.log(`(Crawler) 成功爬取并更新到数据库: ${music.title}`);

    console.log(`(DB) 重新获取刚更新的详情: ${music.title}`);
    const finalMusic = await invoke<Music[]>("get_music_list_by_ids", {
      songIds: [music.song_id],
    }).then((res) => (res ? res[0] : null));

    if (!finalMusic) {
      throw new Error("更新详情后未能从数据库中重新获取，请检查数据库逻辑！");
    }

    // 返回从数据库中拿到的最终数据，它可能包含了后端处理过的信息（如 Base64 封面）
    console.log(`(Crawler) 最终返回详情: ${finalMusic}`);
    return { ...finalMusic, file_path };
  } catch (error) {
    console.error(`获取歌曲 '${music.title}' 详情的完整流程失败:`, error);
    // 即使失败，也返回原始的 music 对象，避免应用崩溃
    // 您也可以根据业务需求抛出错误
    return music;
  }
};

export const fetchMusicPlayUrl = async (
  music: Music,
  fullDetailUrl: string
): Promise<string | null> => {
  const apiUrl = `${BASE_URL}/api/play-url`;

  const apiResponse = await tauriFetch(apiUrl, {
    method: "POST",
    body: `id=${music.play_id}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: BASE_URL,
      Referer: fullDetailUrl,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    },
  });

  if (!apiResponse.ok) {
    throw new Error(`请求播放API失败: ${apiResponse.status}`);
  }
  const apiData = (await apiResponse.json()) as any;
  if (apiData?.code !== 1 || !apiData?.data?.url) {
    throw new Error(apiData.msg || "播放API未返回有效的URL");
  }
  return apiData.data.url;
};

export const fetchMusicDetailInfo = async (
  music: Music,
  fullDetailUrl: string
): Promise<Music> => {
  const response = await tauriFetch(fullDetailUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`请求详情页失败: ${response.status}`);
  }
  const htmlText = (await response.text()) as string;

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
  const cover_url = doc.querySelector<HTMLMetaElement>(
    'meta[property="og:image"]'
  )?.content;
  const lyric =
    doc
      .getElementById("content-lrc")
      ?.innerHTML.replace(/<br\s*\/?>/gi, "\n") || "";

  return {
    ...music,
    play_id: playId,
    song_id: music.song_id,
    lyric: lyric,
    cover_url: (cover_url || appData.mp3_cover)?.replace("http://", "https://"),
    duration: music.duration, // 假设 music 对象中已有 duration
    download_extra:
      extraUrls && extraUrls.length > 0 ? extraUrls[0].share_link : undefined,
    download_mp3_id: mp3Id,
  };
};

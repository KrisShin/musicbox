// src/crawler.ts (或你的API文件)

import { fetch } from '@tauri-apps/plugin-http';
import { Song, SearchResult } from './types'; // 确保类型定义正确

const parser = new DOMParser();

export const searchMusic = async (keyword: string, page: number = 1): Promise<SearchResult> => {
    // 1. 更新为 gequhai.net 的 URL 结构
    const searchUrl = `https://www.gequhai.net/s/${keyword}?page=${page}`;

    try {
        const response = await fetch(searchUrl, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`请求搜索页失败: ${response.status}`);
        }

        const htmlText = await response.text();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // 2. 核心修改：使用新的、更健壮的选择器
        // 直接选取所有包含歌曲信息的 <a> 标签
        const linkElements = doc.querySelectorAll('a.music-link');
        
        const musicList: Song[] = [];

        linkElements.forEach(link => {
            const title = link.querySelector('span.music-title > span')?.textContent;
            const artist = link.querySelector('small.text-jade')?.textContent;
            const detailUrl = link.getAttribute('href'); // e.g., /search_music?song_id=...&...

            if (title && artist && detailUrl) {
                try {
                    // 3. 使用 URLSearchParams 安全地解析 song_id
                    // 它可以处理复杂的URL参数，比 split 更可靠
                    const urlParams = new URLSearchParams(detailUrl.split('?')[1]);
                    const songId = urlParams.get('song_id');

                    if (songId) {
                        musicList.push({
                            songId,
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
        const lastPageItem = doc.querySelector('ul.pagination li.page-item:last-child');
        let hasMore = true;
        // 如果最后一个分页项存在，并且它包含 'disabled' 类，则说明没有下一页了
        if (lastPageItem?.classList.contains('disabled') || !lastPageItem) {
            hasMore = false;
        }
        
        return {
            songs: musicList,
            has_more: hasMore
        };

    } catch (error) {
        console.error("前端爬虫搜索失败:", error);
        throw error;
    }
};
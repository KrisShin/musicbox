// src/types.ts

export interface MusicDetail {
  play_id?: string;
  lyric?: string;
  cover_url?: string;
  duration?: number;
  download_mp3?: string;
  download_extra?: string;
  download_mp3_id?: string;
  play_url?: string;
}

export interface Music extends MusicDetail {
  song_id: string;
  title: string;
  artist: string;
  url: string;
  // (可选) 播放链接
}

export interface SearchResult {
  music_list: Music[];
  has_more: boolean;
}

export interface PlaylistInfo {
  id: number;
  name: string;
  cover_path: string;
  song_count: number;
  is_in: boolean;

  created_at: string; // 可选字段，可能在某些 API 中不存在
  updated_at: string; // 可选字段，可能在某些 API 中不存在
}

export interface PlaylistMusic {
  added_to_list_at: string; // 添加到歌单的时间
  music: Music; // 歌曲信息
  position: number; // 在歌单中的位置
}

export interface UpdateInfo {
  update_available: boolean;
  version: string;
  notes: string;
  download_url: string;
  download_password: string;
}
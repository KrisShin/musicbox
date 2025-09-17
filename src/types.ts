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
  file_path?: string;
  last_played_at?: string;
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

export interface PlaylistMusic extends Music {
}

export interface UpdateInfo {
  update_available: boolean;
  version: string;
  notes: string;
  download_url: string;
  download_password: string;
}

export interface CachedMusicInfo {
  song_id: string;
  title: string;
  artist: string;
  cover_url?: string;
  file_path: string;
  last_played_at?: string;
  file_size_bytes: number;
}

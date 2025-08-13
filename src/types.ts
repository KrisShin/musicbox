// src/types.ts

export interface MusicDetail {
  lyric?: string;
  download_mp3?: string;
  download_kuake?: string;
  cover_url?: string;
  duration?: number;
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
}

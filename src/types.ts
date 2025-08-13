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

export interface Muisc extends MusicDetail {
  song_id: string;
  title: string;
  artist: string;
  url: string;
  // (可选) 播放链接
}

export interface SearchResult {
  music_list: Muisc[];
  has_more: boolean;
}

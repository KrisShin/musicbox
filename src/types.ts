// src/types.ts

export interface SongDetail {
  lyric?: string;
  download_mp3?: string;
  download_kuake?: string;
  cover_url?: string;
  duration?: number;
  download_mp3_id?: number;
  play_url?: string;
}

export interface Song extends SongDetail {
  song_id: string;
  title: string;
  artist: string;
  url: string;
  // (可选) 播放链接
}

export interface SearchResult {
  songs: Song[];
  has_more: boolean;
}

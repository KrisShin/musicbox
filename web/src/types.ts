// src/types.ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  // (可选) 播放链接
  url?: string; 
}

export interface SearchResult {
  songs: Song[];
  has_more: boolean;
}
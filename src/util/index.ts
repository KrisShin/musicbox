export const MEDIA_ADDR = "127.0.0.1:38915";

export const sanitizeFilename = (name: string): string => {
  return name.replace(/[\\/:\*\?"<>\|]/g, "");
};

// 格式化文件大小的辅助函数
export const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// [新增] 格式化相对时间的辅助函数
export const formatRelativeTime = (timeStr?: string): string => {
  if (!timeStr) {
    return "从未";
  }
  const now = new Date();
  const past = new Date(timeStr);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "刚刚";
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小时前`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays <= 7) {
    return `${diffInDays}天前`;
  }
  if (diffInDays <= 30) {
    return `${Math.floor(diffInDays / 7)}周前`;
  }
  return "超过1月";
};

export const buildMusicFileUrl = (file_path: string | null | undefined): string => {
  if (!file_path) {
    return ""; // 默认封面
  }
  return `http://${MEDIA_ADDR}/music_cache/${file_path}`;
};

export const buildCoverUrl = (coverPath: string | null | undefined): string => {
  if (!coverPath) {
    return "/icon.png"; // 默认封面
  }
  // 检查它是否已经是 Base64 或完整的 http 链接（用于兼容旧数据）
  if (coverPath.startsWith("data:") || coverPath.startsWith("http")) {
    return coverPath;
  }
  // 否则，它是文件名，我们拼接本地服务器地址
  return `http://${MEDIA_ADDR}/cover_cache/${coverPath}`;
};

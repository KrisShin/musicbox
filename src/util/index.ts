export const sanitizeFilename = (name: string): string => {
    return name.replace(/[\\/:\*\?"<>\|]/g, '');
};

// 格式化文件大小的辅助函数
export const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// [新增] 格式化相对时间的辅助函数
export const formatRelativeTime = (timeStr?: string): string => {
    if (!timeStr) {
        return '从未';
    }
    const now = new Date();
    const past = new Date(timeStr);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return '刚刚';
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
    return '超过1月';
};

import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Music } from "../types";

export async function cacheSongWithNotifications(music: Music): Promise<void> {
  try {
    // 1. 检查并请求权限 (一次授权，终身使用)
    let hasPermission = await isPermissionGranted();
    if (!hasPermission) {
      const permissionResult = await requestPermission();
      hasPermission = permissionResult === 'granted';
    }

    // 2. 如果有权限，发送“开始缓存”通知
    if (hasPermission) {
      sendNotification({
        title: '开始缓存',
        body: `正在将《${music.title}》保存到本地...`,
        // 你还可以添加一个图标
        // icon: 'path/to/icon.png'
      });
    }

    // 3. 执行核心的缓存操作
    // await performCaching(music);

    // 4. 缓存成功后，发送“完成”通知
    if (hasPermission) {
      sendNotification({
        title: '缓存完成 🎉',
        body: `歌曲《${music.title}》已成功保存到本地！`,
      });
    }

  } catch (error) {
    console.error(`缓存歌曲《${music.title}》时出错:`, error);
    
    // 5. (可选) 如果失败，也可以发送一个失败通知
    const hasPermission = await isPermissionGranted();
    if (hasPermission) {
      sendNotification({
        title: '缓存失败 😥',
        body: `无法缓存歌曲《${music.title}》，请检查网络或稍后重试。`,
      });
    }
  }
}
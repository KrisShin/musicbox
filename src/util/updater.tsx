import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button, Flex } from 'antd';
import { UpdateInfo } from '../types';
// import { platform } from '@tauri-apps/plugin-os';

// 定义函数所需的 API 接口，使类型更清晰
interface UpdaterApi {
  messageApi: {
    info: (msg: string, duration?: number) => void;
    success: (msg: string, duration?: number) => void;
    error: (msg: string, duration?: number) => void;
  };
  modalApi: {
    confirm: (options: any) => { destroy: () => void };
  };
}

/**
 * 检查应用更新
 * @param force - 是否强制检查。如果为 true，将忽略先前“忽略此版本”的选择。
 * @param messageApi - antd 的 message API 实例
 * @param modalApi - antd 的 modal API 实例
 */
export const checkForUpdates = async ({ force = false, messageApi, modalApi }: { force?: boolean } & UpdaterApi) => {
  try {
    const result: UpdateInfo = await invoke('check_for_updates', { force });

    if (result.update_available) {
      let modalInstance: any = null;

      const copy2Clipboard = async () => {
        if (!result.download_password) return;
        try {
          await writeText(result.download_password);
          messageApi.success('密码已复制到剪贴板！');
        } catch (err) {
          console.error('复制失败:', err);
          messageApi.error('复制失败，请手动复制。');
        }
      };

      const handleGoNow = async () => {
        if (result?.download_url) {
          await copy2Clipboard();
          try {
            await openUrl(result.download_url);
          } catch (err) {
            console.error("无法打开下载链接:", err);
            messageApi.error("无法打开下载链接，请手动复制。");
          }
        } else {
          messageApi.error("下载链接无效！");
        }
        modalInstance?.destroy();
      };

      const handleIgnoreVersion = () => {
        invoke('ignore_update', { version: result.version })
          .then(() => messageApi.info(`已忽略版本 v${result.version}，不再提醒。`))
          .catch(err => console.error("忽略版本失败:", err));
        modalInstance?.destroy();
      };

      const handleRemindLater = () => {
        modalInstance?.destroy();
      };

      modalInstance = modalApi.confirm({
        title: `发现新版本 v${result.version}`,
        content: (
          <div>
            <p>有新的更新可用，是否立即下载？</p>
            <p><strong>更新日志:</strong></p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{result.notes}</p>
            {result.download_password && (
              <p>
                <strong>下载密码: </strong>
                <span
                  onClick={copy2Clipboard}
                  style={{ color: "#F08080", cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                >
                  {result.download_password}
                </span>
              </p>
            )}
          </div>
        ),
        footer: (
          <Flex justify='end' gap="small" style={{ marginTop: '16px' }}>
            <Button type='text' onClick={handleIgnoreVersion}>忽略此版本</Button>
            <Button onClick={handleRemindLater}>下次再说</Button>
            <Button type="primary" onClick={handleGoNow}>
              立即前往
            </Button>
          </Flex>
        ),
      });
    } else if (force) {
      messageApi.info("当前已是最新版本。");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (force) {
      messageApi.error(`检查更新失败: ${errorMessage}`);
    }
    console.error("检查更新失败:", error);
  }
};
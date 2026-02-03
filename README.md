# MusicBox by Tauri V2

tech stack: Tauri V2 + React + Typescript

This is a music downloader client for learning Tauri V2, And you can search/download music by this client.
We will support multi-platform, welcome try in [Release](https://github.com/KrisShin/musicbox/releases)

## Change log

### Release 20260203 
- 1. [修复]无法搜到歌曲 
- 2. [修复]部分已知bug

### Release 20260202 
- 1. [修复]歌曲解析失败导致无法下载和播放 
- 2. [修复]部分已知bug

### Release 20250925
- 1. [优化]下载文件重复命名逻辑 
- 2. [优化]重复触发下载阻塞 
- 3. [优化]下载阻塞逻辑判断规则
- 4. [优化]页面布局单位
- 5. [新增]可以新增歌单了(最多8个, 应该是够用了)
- 6. [新增]缓存已选中的歌单
- 7. [优化]重构搜索页面, 优化使用体验
- 8. [新增]选中歌单缓存
- 9. [修复]部分地方展示位置错误
- 10. [新增]软件当前版本号
- 11. [新增]删除歌单操作
- 12. [新增]导入其他设备的歌单
- 13. [修复]部分已知bug

### 待修复
- 1. 安卓10及以下公共存储空间读写权限问题导致无法下载

#### Release 20250917

- 1. [新增]支持手动清理歌单外的缓存文件
- 2. [新增]支持手动清理超过 3 个月未播放的歌曲
- 3. [新增]支持手动清理全部缓存
- 4. [新增]支持手动清理歌单缓存
- 5. [新增]支持自动清理超过设置大小的文件
- 6. [新增]支持自动清理超过 3 个月未播放的歌曲
- 7. [优化]歌单支持搜索歌曲
- 8. [优化]歌单支持修改封面
- 9. [优化]歌单修复默认封面
- 10. [优化]悬浮播放器可以切换隐藏显示
- 11. [优化]图片加载显示方式
- 12. [优化]批量下载修改为加载一首就立即下载, 不需要等待全部加载完后统一下载
- 13. [优化]所有下载增加系统通知
- 14. [优化]修复歌单页面歌曲过多导致渲染缓慢问题
- 15. [修复]了部分已知bug

#### Release 20250912

- 1. 支持自定义下载路径(家目录 Download 下)
- 2. 支持自定义下载文件名格式
- 3. 修改了歌单中的歌曲顺序(新加入的在上面)
- 4. 修复了部分已知 bug

#### Release 20250911

困扰了我好几周的问题, 今天终于解决, 安卓端终于完美支持批量下载了, 会统一下载到 Download/MusicBox 里面, 我愿称这次是史诗级更新

- 1. 安卓端终于完美支持批量下载 😭😭😭
- 2. 优化了导航栏显示和跳转
- 3. 修复了部分已知 bug

## Client(Android)

<img src="/assets/example.gif" width="400px" alt="Desktop client">

# 🌟 Acknowledgement

MusicBox is an open source project under the MIT license. This means that you are free to use, modify and distribute the code.

The license itself is not mandatory if you use the software in your project:

I would appreciate it if you could add MusicBox to your software's About page or Acknowledgments section with a link to this repository!

A Star ⭐ for this project would also be a great encouragement to me!

It's not a legal obligation, but every kind gesture you make is what keeps the open source community going. Thank you!

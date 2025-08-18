import { memo, useState } from "react";
import { Music, PlaylistInfo } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import { Avatar, Button, Flex, List, message, Popover, Spin, Typography } from "antd";
import { CheckOutlined, PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

const AddToPlaylistButton = memo(({
    song,
    primaryThemeColor,
}: {
    song: Music;
    primaryThemeColor: string;
}) => {
    const [messageApi, contextHolder] = message.useMessage(); // 使用 Ant Design 的 message API
    // --- State ---
    const [open, setOpen] = useState(false); // 控制 Popover 的显示与隐藏
    const [loading, setLoading] = useState(false); // 控制加载状态
    const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]); // 存储歌单列表

    // --- Functions ---

    const handleAdd2Playlist = async (music: Music, playlistId: number) => {
        try {
            const payload = {
                playlist_id: playlistId,
                song_ids: [music.song_id], // 我们的后端接口接收的是一个数组
            };

            await invoke("toggle_music_in_playlist", { payload });

            // 给予用户即时反馈
            messageApi.success(`“${music.title}” 操作成功!`);
        } catch (error) {
            console.error(
                `操作歌曲 ${music.title} 到歌单 ${playlistId} 失败:`,
                error
            );
            messageApi.error("操作失败，请稍后再试");
        }
    };

    // Popover 显示状态改变时的回调
    const handleOpenChange = async (newOpen: boolean) => {
        setOpen(newOpen);
        // 只有在准备打开 Popover 且列表为空时才去获取数据
        if (newOpen) {
            setLoading(true);
            try {
                // 调用我们强大的后端接口，传入 song_id 来获取 is_in 状态
                const result: PlaylistInfo[] = await invoke("get_all_playlists", {
                    songId: song.song_id,
                });
                setPlaylists(result);
            } catch (error) {
                console.error("获取歌单列表失败:", error);
                messageApi.error("无法加载歌单列表");
                setOpen(false); // 加载失败时关闭 Popover
            } finally {
                setLoading(false);
            }
        }
    };

    // 点击某个歌单项时的处理函数
    const onPlaylistClick = (playlist: PlaylistInfo) => {
        // 调用我们之前定义的通用函数
        handleAdd2Playlist(song, playlist.id);
        // 操作后立即关闭 Popover
        setOpen(false);
    };

    // --- Render ---

    // 这是 Popover 内部要渲染的内容
    const playlistContent = (
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {loading ? (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "20px",
                    }}
                >
                    <Spin />
                </div>
            ) : (
                <List
                    size="small"
                    bordered
                    dataSource={playlists}
                    renderItem={(playlist) => (
                        <List.Item
                            onClick={() => onPlaylistClick(playlist)}
                            style={{ cursor: "pointer" }}
                            actions={[
                                // 如果歌曲已在歌单中，显示一个√
                                playlist.is_in && (
                                    <CheckOutlined style={{ color: primaryThemeColor }} />
                                ),
                            ]}
                        >
                            <Flex align="center">
                                <Avatar size={22} shape="square" src={`${playlist?.cover_path}`} />
                                <Text style={{ fontSize: "14px" }}>{playlist.name}({playlist.song_count})</Text>
                            </Flex>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );

    return (
        <Popover
            content={playlistContent}
            title="添加到歌单"
            trigger="click"
            open={open}
            onOpenChange={handleOpenChange}
            placement="left" // 让菜单在左侧弹出
        >
            {contextHolder}
            <Button
                type="text"
                icon={<PlusOutlined style={{ color: primaryThemeColor }} />}
            />
        </Popover>
    );
})

export default AddToPlaylistButton;
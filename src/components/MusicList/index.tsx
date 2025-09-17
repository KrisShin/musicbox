import { Button, List, Typography } from "antd";
import { memo } from "react";
import AddToPlaylistButton from "../Add2Playlist";
import { PlayCircleOutlined } from "@ant-design/icons";
import { Music } from "../../types";
import { useGlobalMessage } from "../MessageHook";

const { Text } = Typography;

const MusicListItem = memo(({ item, index, primaryThemeColor, handlePlayFromSearch }: { item: Music, index: number, primaryThemeColor: string, handlePlayFromSearch: Function }) => {
    // console.log(`Rendering item: ${item.title}`); // 您可以加上这个来观察渲染次数
    const messageApi = useGlobalMessage();

    const onHandlePlayFromSearch = (music: Music, index: number) => {
        try {
      messageApi.destroy();
            messageApi.info(`正在加载 ${music.title} 的详情...`, 1.5);
            handlePlayFromSearch(index)
        } catch (error) {
      messageApi.destroy();
            messageApi.error(`播放 ${music.title}失败, 请稍后重试`);
            console.error(`播放 ${music.title} 失败:`, error);
        }
    };

    return (
        <List.Item
            actions={[
                <AddToPlaylistButton
                    song={item}
                    primaryThemeColor={primaryThemeColor}
                />,
                <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => onHandlePlayFromSearch(item, index)}
                />,
            ]}
        >
            <List.Item.Meta
                title={<Text>{item.title}</Text>}
                description={`${item.artist}`}
            />
        </List.Item>
    );
});

export default MusicListItem;
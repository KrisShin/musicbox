import { Button, List, Typography } from "antd";
import { memo } from "react";
import AddToPlaylistButton from "../Add2Playlist";
import { PlayCircleOutlined } from "@ant-design/icons";
import { Music } from "../../types";
import { useGlobalMessage } from "../MessageHook";

const { Text } = Typography;

const MusicListItem = memo(({ item, index, primaryThemeColor, handleDetail }: { item: Music, index: number, primaryThemeColor: string, handleDetail: Function }) => {
    // console.log(`Rendering item: ${item.title}`); // 您可以加上这个来观察渲染次数
    const messageApi = useGlobalMessage();

    const onHandleDetail = (music: Music, index: number) => {
        try {
            messageApi.info(`正在加载 ${music.title} 的详情...`, 1.5);
            handleDetail(index)
        } catch (error) {
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
                    onClick={() => onHandleDetail(item, index)}
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
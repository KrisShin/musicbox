import { Button, List, Typography } from "antd";
import { memo } from "react";
import AddToPlaylistButton from "../Add2Playlist";
import { PlayCircleOutlined } from "@ant-design/icons";
import { Music } from "../../types";

const { Text } = Typography;

const MusicListItem = memo(({ item, index, primaryThemeColor, handleDetail }: { item: Music, index: number, primaryThemeColor: string, handleDetail: Function }) => {
    // console.log(`Rendering item: ${item.title}`); // 您可以加上这个来观察渲染次数

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
                    onClick={() => handleDetail(item, index)}
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
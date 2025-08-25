import { Flex, List } from 'antd';
import React from 'react';
import { ClearOutlined, DatabaseOutlined, ExportOutlined, FileProtectOutlined, ImportOutlined, InfoCircleOutlined, SelectOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
import { useGlobalMessage } from '../../components/MessageHook';



const SettingPage: React.FC = () => {
    const iconSize = '20px';
    const settings = [
        { title: '清除缓存', icon: <ClearOutlined style={{ fontSize: iconSize }} />, desc: "清空所有缓存的音乐文件, 会让播放加载变慢" },
        { title: '导入本地音乐', icon: <ImportOutlined style={{ fontSize: iconSize }} />, desc: "导入你自己的音乐文件夹" },
        { title: '导出播放列表', icon: <ExportOutlined style={{ fontSize: iconSize }} />, desc: "导出当前的播放列表给其他musicbox客户端用" },
        { title: '导入播放列表', icon: <SelectOutlined style={{ fontSize: iconSize }} />, desc: "导入来自其他musicbox客户端的播放列表" },
        { title: '检查更新', icon: <SettingOutlined style={{ fontSize: iconSize }} />, desc: "手动检查是否有更新发布" },
        { title: '反馈与支持', icon: <SendOutlined style={{ fontSize: iconSize }} />, desc: "反馈意见或建议给Kris" },
        { title: '隐私政策', icon: <FileProtectOutlined style={{ fontSize: iconSize }} />, desc: "我们非常尊重您的隐私" },
        { title: '关于 MusicBox', icon: <InfoCircleOutlined style={{ fontSize: iconSize }} />, desc: "关于MusicBox的一些信息" },
        { title: '清空数据库', icon: <DatabaseOutlined style={{ fontSize: iconSize, color: 'red' }} />, desc: "如果你遇到了无法解决的问题, 这会清空您的全部数据" },
    ]

    const messageApi = useGlobalMessage();

    return (
        <Flex vertical style={{ padding: '15px', marginBottom: '60px' }} gap="16px">
            <List
                itemLayout="horizontal"
                dataSource={settings}
                size='small'
                renderItem={(item, _index) => (
                    <List.Item
                        onClick={() => {
                            console.log(item.title)
                            messageApi.info(`${item.title} 功能尚未完成, 请等待后续版本`, 1);
                        }}>
                        <List.Item.Meta
                            avatar={item.icon}
                            title={item.title}
                            description={item.desc}

                        />
                    </List.Item>
                )}
            />

        </Flex >
    );
};

export default SettingPage;
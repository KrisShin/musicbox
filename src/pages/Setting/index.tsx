import { Flex, List } from 'antd';
import React from 'react';
import { ClearOutlined, DatabaseOutlined, ExportOutlined, FileProtectOutlined, ImportOutlined, InfoCircleOutlined, SelectOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
import { useGlobalMessage, useGlobalModal } from '../../components/MessageHook';
import { useNavigate } from 'react-router-dom';
import { checkForUpdates } from '../../util/updater';


const SettingPage: React.FC = () => {
    const iconSize = '18px';
    const settings = [
        { tag: 'clearCache', title: '清除缓存', icon: <ClearOutlined style={{ fontSize: iconSize }} />, desc: "清空所有缓存的音乐文件, 会让播放加载变慢" },
        { tag: 'importLocal', title: '导入本地音乐', icon: <ImportOutlined style={{ fontSize: iconSize }} />, desc: "导入你自己的音乐文件夹" },
        { tag: 'exportDB', title: '导出播放列表', icon: <ExportOutlined style={{ fontSize: iconSize }} />, desc: "导出当前的播放列表给其他musicbox客户端用" },
        { tag: 'importDB', title: '导入播放列表', icon: <SelectOutlined style={{ fontSize: iconSize }} />, desc: "导入来自其他musicbox客户端的播放列表" },
        { tag: 'updater', title: '检查更新', icon: <SettingOutlined style={{ fontSize: iconSize }} />, desc: "手动检查是否有更新发布" },
        { tag: 'feedback', title: '反馈与支持', icon: <SendOutlined style={{ fontSize: iconSize }} />, desc: "反馈意见或建议给Kris" },
        { tag: 'privacy', title: '隐私政策', icon: <FileProtectOutlined style={{ fontSize: iconSize }} />, desc: "我们非常尊重您的隐私" },
        { tag: 'about', title: '关于 MusicBox', icon: <InfoCircleOutlined style={{ fontSize: iconSize }} />, desc: "关于MusicBox的一些信息" },
        { tag: 'reset', title: '重置App', icon: <DatabaseOutlined style={{ fontSize: iconSize, color: 'red' }} />, desc: "如果你遇到了无法解决的问题, 这会重置您的全部数据" },
    ]

    const messageApi = useGlobalMessage();
    const modalApi = useGlobalModal();
    const navigate = useNavigate();

    // messageApi.info(`${item.title} 功能尚未完成, 请等待后续版本`, 1);
    const handleClearCache = () => { messageApi.info(`功能尚未完成, 请等待后续版本`, 1); }
    const handleImportLocal = () => { messageApi.info(`功能尚未完成, 请等待后续版本`, 1); }
    const handleExportDB = () => { messageApi.info(`功能尚未完成, 请等待后续版本`, 1); }
    const handleImportDB = () => { messageApi.info(`功能尚未完成, 请等待后续版本`, 1); }
    const handleUpdater = () => {
        messageApi.info('正在检查更新...', 1);
        checkForUpdates({ force: true, messageApi, modalApi }); // 强制检查
    };
    const handleFeedback = () => { messageApi.info(`功能尚未完成, 请等待后续版本`, 1); }
    const handlePrivacy = () => { navigate('/setting/privacy'); }
    const handleAbout = () => { navigate('/setting/about'); }
    const handleReset = () => { messageApi.info(`功能尚未完成, 请等待后续版本`, 1); }

    const handleSetting = (tag: string) => {
        switch (tag) {
            case 'clearCache': handleClearCache(); break;
            case 'importLocal': handleImportLocal(); break;
            case 'exportDB': handleExportDB(); break;
            case 'importDB': handleImportDB(); break;
            case 'updater': handleUpdater(); break;
            case 'feedback': handleFeedback(); break;
            case 'privacy': handlePrivacy(); break;
            case 'about': handleAbout(); break;
            case 'reset': handleReset(); break;
        }
    }

    return (
        <Flex vertical style={{ padding: '15px', marginBottom: '60px' }} gap="16px">
            <List
                itemLayout="horizontal"
                dataSource={settings}
                size='small'
                renderItem={(item, _index) => (
                    <List.Item
                        onClick={() => {
                            handleSetting(item.tag);
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
import { Button, Checkbox, Flex, Form, Input, List, Modal, Radio } from 'antd';
import React, { useEffect, useState } from 'react';
import { ClearOutlined, DatabaseOutlined, DownloadOutlined, ExportOutlined, FileProtectOutlined, ImportOutlined, InfoCircleOutlined, SelectOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
import { useGlobalMessage, useGlobalModal } from '../../components/MessageHook';
import { useNavigate } from 'react-router-dom';
import { checkForUpdates } from '../../util/updater';
import { invoke } from '@tauri-apps/api/core';
import { primaryThemeColor } from '../../main';


const SettingPage: React.FC = () => {
    const iconSize = '18px';

    const messageApi = useGlobalMessage();
    const modalApi = useGlobalModal();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [downloadSettingOpen, setDownloadSettingOpen] = useState(false);
    const [cacheSize, setCacheSize] = useState("计算中...");

    const settings = [
        { tag: 'downloadSetting', title: '下载设置', icon: <DownloadOutlined style={{ fontSize: iconSize, color: primaryThemeColor }} />, desc: "下载保存的位置和文件名格式" },
        { tag: 'manageCache', title: '管理缓存', icon: <ClearOutlined style={{ fontSize: iconSize, color: primaryThemeColor }} />, desc: `管理缓存的音乐文件`, extra: cacheSize },
        { tag: 'importLocal', title: '导入本地音乐', icon: <ImportOutlined style={{ fontSize: iconSize, color: '' }} />, desc: "导入你自己的音乐文件夹" },
        { tag: 'exportDB', title: '导出播放列表', icon: <ExportOutlined style={{ fontSize: iconSize, color: '' }} />, desc: "导出播放列表给其他MusicBox客户端" },
        { tag: 'importDB', title: '导入播放列表', icon: <SelectOutlined style={{ fontSize: iconSize, color: '' }} />, desc: "导入来自其他MusicBox客户端的播放列表" },
        { tag: 'updater', title: '检查更新', icon: <SettingOutlined style={{ fontSize: iconSize, color: primaryThemeColor }} />, desc: "手动检查是否有更新发布" },
        { tag: 'feedback', title: '反馈与支持', icon: <SendOutlined style={{ fontSize: iconSize, color: '' }} />, desc: "反馈意见或建议给开发者" },
        { tag: 'privacy', title: '隐私政策', icon: <FileProtectOutlined style={{ fontSize: iconSize, color: primaryThemeColor }} />, desc: "我们非常尊重您的隐私" },
        { tag: 'about', title: '关于 MusicBox', icon: <InfoCircleOutlined style={{ fontSize: iconSize, color: primaryThemeColor }} />, desc: "关于MusicBox的一些信息" },
        { tag: 'reset', title: '重置App', icon: <DatabaseOutlined style={{ fontSize: iconSize, color: 'red' }} />, desc: "如果你遇到了无法解决的问题, 这会重置您的全部数据" },
    ]

    // messageApi.info(`${item.title} 功能尚未完成, 请等待后续版本`, 1);
    // 保存设置的处理函数
    const handleManageCache = () => navigate('/setting/cache')
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
            case 'downloadSetting': setDownloadSettingOpen(true); break;
            case 'manageCache': handleManageCache(); break;
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

    const handleSaveSettings = async (values: any) => {
        try {
            await invoke('save_app_setting', { key: 'download_path', value: values.downloadPath });
            await invoke('save_app_setting', { key: 'filename_format', value: values.filenameFormat });
            await invoke('save_app_setting', { key: 'filename_remove_spaces', value: String(values.filenameRemoveSpaces) });
            messageApi.success('设置已保存！');
            setDownloadSettingOpen(false);
        } catch (error) {
            messageApi.error('保存设置失败');
        }
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const downloadPath = await invoke('get_app_setting', { key: 'download_path' });
                const filenameFormat = await invoke('get_app_setting', { key: 'filename_format' });
                const filenameRemoveSpaces = await invoke('get_app_setting', { key: 'filename_remove_spaces' });

                form.setFieldsValue({
                    downloadPath: downloadPath || 'MusicBox',
                    filenameFormat: filenameFormat || 'title_artist',
                    filenameRemoveSpaces: filenameRemoveSpaces === 'true',
                });
            } catch (error) {
                messageApi.error('加载设置失败');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [form, messageApi]);

    useEffect(() => {
        // 组件加载时获取缓存大小
        invoke<string>('get_cache_size')
            .then(setCacheSize)
            .catch(err => {
                console.error(err);
                setCacheSize("获取失败");
            });
    }, []);

    return (
        <Flex vertical style={{ padding: '15px', marginBottom: '60px' }} gap="16px">
            <List
                itemLayout="horizontal"
                dataSource={settings}
                size='small'
                renderItem={(item, _index) => (
                    <List.Item
                        onClick={() => handleSetting(item.tag)}
                        actions={item.extra ? [<span key="1" style={{ fontSize: '12px', color: '#888' }}>{item.extra}</span>] : []}
                    >
                        <List.Item.Meta
                            avatar={item.icon}
                            title={item.title}
                            description={item.desc}
                        />
                    </List.Item>
                )}
            />
            <Modal title="下载设置" open={downloadSettingOpen} footer={null} onCancel={() => setDownloadSettingOpen(false)}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveSettings}
                    disabled={loading}
                >
                    <Form.Item
                        name="downloadPath"
                        label="下载文件夹名称"
                        tooltip="此文件夹将被创建在您系统的'下载'目录中 (桌面端) 或 /storage/emulated/0/Download/ (安卓端)"
                        rules={[{ required: true, message: '请输入文件夹名称' }]}
                    >
                        <Input placeholder="例如: MusicBox" />
                    </Form.Item>

                    <Form.Item name="filenameFormat" label="导出文件名格式">
                        <Radio.Group>
                            <Radio value="title_artist">歌名 - 歌手</Radio>
                            <Radio value="artist_title">歌手 - 歌名</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item name="filenameRemoveSpaces" valuePropName="checked">
                        <Checkbox>移除文件名中的空格</Checkbox>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            保存下载设置
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Flex >
    );
};

export default SettingPage;
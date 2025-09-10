import React from 'react';
import { Card, Avatar, Typography, Button } from 'antd';
import { ArrowLeftOutlined, GithubOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { primaryThemeColor } from '../../main';

const { Title, Paragraph } = Typography;

const AboutPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{}}>
            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ArrowLeftOutlined
                            onClick={() => navigate(-1)}
                            style={{ marginRight: '16px', cursor: 'pointer', fontSize: '16px', color: primaryThemeColor }}
                        />
                        <span>关于 MusicBox</span>
                    </div>
                }>
                <div style={{ textAlign: 'center', marginBottom: '0px' }}>
                    <Avatar size={128} src="/icon.png" />
                    <Title level={2}>MusicBox</Title>
                    <Paragraph>基于Tauri V2构建的多平台音乐播放器</Paragraph>
                </div>
                <Card type="inner" title="关于作者">
                    <Paragraph>
                        我是 Kris. 我是一个对开发充满热情的独立开发者. 感谢你的使用和宝贵的反馈!
                    </Paragraph>
                    <Paragraph>
                        你可以在GitHub上找到我, 这是我的主页<Button
                            type="link"
                            icon={<GithubOutlined />}
                            href="https://github.com/krisshin"
                            target="_blank"
                        >
                            KrisShin GitHub 主页
                        </Button>
                    </Paragraph>
                </Card>
                <Card
                    style={{ marginTop: 16 }}
                    type="inner"
                    title="关于项目"
                >
                    <Paragraph>
                        MusicBox 是一个开源项目, 旨在提供一个简洁、美观、易用的音乐播放器.
                    </Paragraph>
                    <Paragraph>
                        如果你对这个项目感兴趣, 欢迎访问我们的GitHub仓库, 并给我们一个Star!
                    </Paragraph>
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Button
                            type="primary"
                            icon={<GithubOutlined />}
                            href="https://github.com/krisshin/musicbox"
                            target="_blank"
                        >
                            GitHub 仓库
                        </Button>
                    </div>
                </Card>
            </Card>
        </div>
    );
};

export default AboutPage;
import React from 'react';
import { Card, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { primaryThemeColor } from '../../main';

const { Title, Paragraph, Text } = Typography;

const PrivacyPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div >
            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ArrowLeftOutlined
                            onClick={() => navigate(-1)}
                            style={{ marginRight: '1rem', cursor: 'pointer', fontSize: '1rem', color: primaryThemeColor }}
                        />
                        <span>隐私政策</span>
                    </div>
                }
            >
                <Title level={4}>MusicBox 隐私政策</Title>
                <Paragraph>
                    更新日期：2025年9月8日
                </Paragraph>
                <Paragraph>
                    欢迎使用 MusicBox！我们深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。我们致力于维持您对我们的信任，恪守以下原则，保护您的个人信息：权责一致原则、目的明确原则、选择同意原则、最少够用原则、确保安全原则、主体参与原则、公开透明原则等。
                </Paragraph>

                <Title level={5}>一、我们如何收集和使用您的个人信息</Title>
                <Paragraph>
                    MusicBox 是一款纯客户端应用，我们承诺：
                    <ul>
                        <li><Text strong>不收集任何个人身份信息</Text>：我们不会收集您的姓名、电子邮箱、电话号码、地址等任何可用于识别您个人身份的信息。</li>
                        <li><Text strong>不上传用户数据</Text>：您本地的播放列表、音乐文件、缓存等所有数据均存储在您的设备上，不会上传到任何服务器。</li>
                        <li><Text strong>不追踪用户行为</Text>：我们不会使用任何技术追踪或分析您的使用习惯和偏好。</li>
                    </ul>
                </Paragraph>

                <Title level={5}>二、设备权限调用</Title>
                <Paragraph>
                    在您使用 MusicBox 的过程中，我们可能会需要调用您的一些设备权限，例如：
                    <ul>
                        <li><Text strong>存储权限</Text>：用于读取您本地的音乐文件、存储播放列表数据库以及缓存音乐封面和音频文件。这是应用的核心功能所必需的。</li>
                        <li><Text strong>网络权限</Text>：仅用于检查应用更新。我们不会通过网络传输您的任何个人数据。</li>
                    </ul>
                    我们仅在实现产品功能所必需时才会调用这些权限，并会事先征求您的同意。
                </Paragraph>

                <Title level={5}>三、本政策如何更新</Title>
                <Paragraph>
                    我们可能会适时对本政策进行修订。当本政策的条款发生变更时，我们会在版本更新时以适当的方式向您展示变更后的内容。
                </Paragraph>

                <Title level={5}>四、联系我们</Title>
                <Paragraph>
                    如果您对本隐私政策有任何疑问、意见或建议，欢迎通过应用内的“反馈与支持”功能与我们联系。
                </Paragraph>
            </Card>
        </div>
    );
};

export default PrivacyPage;
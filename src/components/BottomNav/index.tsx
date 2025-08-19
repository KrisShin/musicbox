import React from 'react';
import { Layout, Flex, Button } from 'antd';
import { SearchOutlined, UnorderedListOutlined, PlaySquareOutlined } from '@ant-design/icons';

const { Footer } = Layout;

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
    const navItems = [
        { key: 'search', icon: <SearchOutlined />, label: '搜索' },
        { key: 'playlist', icon: <UnorderedListOutlined />, label: '歌单' },
        { key: 'player', icon: <PlaySquareOutlined />, label: '播放' },
    ];

    return (
        <Footer style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#fff5f5',
            borderRadius: "15px 15px 0 0",
            padding: "8px 14px 28px 14px",
            borderTop: "5px solid #ffb5b5ff",
            zIndex: 10,
        }}>
            <Flex justify="space-around">
                {navItems.map(item => (
                    <Button
                        size='large'
                        key={item.key}
                        type={activeTab === item.key ? 'primary' : 'text'}
                        icon={item.icon}
                        onClick={() => onTabChange(item.key)}
                        style={{ flexDirection: 'column', height: 'auto', padding: '6px 10px' }}
                    >
                        {/* <span style={{ fontSize: '12px' }}>{item.label}</span> */}
                    </Button>
                ))}
            </Flex>
        </Footer>
    );
};

export default BottomNav;
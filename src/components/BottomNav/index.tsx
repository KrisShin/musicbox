// src/components/BottomNav/index.tsx

import React from 'react';
import { Flex } from 'antd';
import { SearchOutlined, UnorderedListOutlined, PlaySquareOutlined, SettingOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    path: string;
    isActive: boolean;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => {
    const color = isActive ? '#F08080' : '#888';
    return (
        <Flex vertical align="center" justify="center" gap={4} onClick={onClick} style={{ cursor: 'pointer', color, padding:'6px 20px' }}>
            {icon}
            <span style={{ fontSize: '12px', lineHeight: 1 }}>{label}</span>
        </Flex>
    );
};

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentMusic = useAppStore(state => state.currentMusic);

    const iconStyle = { fontSize: '21px' };
    const navItems = [
        { icon: <SearchOutlined style={iconStyle} />, label: '发现', path: '/' },
        { icon: <UnorderedListOutlined style={iconStyle} />, label: '歌单', path: '/playlist' },
        { icon: <PlaySquareOutlined style={iconStyle} />, label: '播放', path: '/player' },
        { icon: <SettingOutlined style={iconStyle} />, label: '设置', path: '/setting' },
    ];

    const handleNavigate = (path: string) => {
        if (path === '/player' && !currentMusic) {
            // 如果没有当前音乐，则不允许跳转到播放器页面
            return;
        }
        navigate(path);
    };

    return (
        <Flex
            justify="space-around"
            align="center"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: `calc(60px + env(safe-area-inset-bottom))`,
                paddingBottom: `env(safe-area-inset-bottom)`,
                backgroundColor: '#fff5f5',
                borderTop: '1px solid #ffb5b5',
                zIndex: 10
            }}
        >
            {navItems.map(item => (
                <NavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    isActive={location.pathname === item.path}
                    onClick={() => handleNavigate(item.path)}
                />
            ))}
        </Flex>
    );
};

export default BottomNav;
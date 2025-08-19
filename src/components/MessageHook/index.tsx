// src/contexts/MessageContext.tsx
import { createContext, useContext } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

// 从 antd 导出 useModal hook 返回的实例类型
type ModalInstance = Omit<ModalStaticFunctions, 'warn'>;

// 创建一个 Context，它的值将是 messageApi
export const MessageContext = createContext<MessageInstance | null>(null);
export const ModalContext = createContext<ModalInstance | null>(null);

// 创建一个自定义 Hook，方便子组件使用
export const useGlobalMessage = () => {
    const messageApi = useContext(MessageContext);
    if (!messageApi) {
        throw new Error('useGlobalMessage must be used within a MessageProvider');
    }
    return messageApi;
};

export const useGlobalModal = () => {
    const modal = useContext(ModalContext);
    if (!modal) {
        throw new Error('useGlobalModal must be used within a ModalContext.Provider');
    }
    return modal;
};
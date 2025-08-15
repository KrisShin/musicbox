// src/contexts/MessageContext.tsx
import { createContext, useContext } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';

// 创建一个 Context，它的值将是 messageApi
export const MessageContext = createContext<MessageInstance | null>(null);

// 创建一个自定义 Hook，方便子组件使用
export const useGlobalMessage = () => {
    const messageApi = useContext(MessageContext);
    if (!messageApi) {
        throw new Error('useGlobalMessage must be used within a MessageProvider');
    }
    return messageApi;
};
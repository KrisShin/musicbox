

// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfigProvider, message, Modal } from 'antd'; // 1. 额外导入 antd 的 App 和 message
import { MessageContext, ModalContext } from './components/MessageHook'; // 2. 导入我们创建的 Context
export const primaryThemeColor = "#F08080";

// 3. 创建一个包含所有 Provider 的顶层组件
const Root = () => {
  // 实例化 useMessage Hook
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  return (
    <React.StrictMode>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: primaryThemeColor,
          },
          components: {
            Button: {
              colorPrimary: primaryThemeColor
            },
            Slider: {
              railBg: '#e7c9b5ff',
              handleColor: primaryThemeColor,
              trackBg: primaryThemeColor
            },
          },
        }}
        message={{
          style: {
            marginTop: "70vh",
          },
        }}
      >
        {/* 4. 使用 Provider 将 messageApi 共享给所有子组件 */}
        <MessageContext.Provider value={messageApi}>
          <ModalContext.Provider value={modalApi}>
            {/* 这里是 Modal 的 contextHolder */}
            {messageContextHolder}
            {modalContextHolder}
            <App />
          </ModalContext.Provider>
        </MessageContext.Provider>
      </ConfigProvider>
    </React.StrictMode>
  );
};


ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
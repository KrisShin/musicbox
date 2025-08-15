

// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfigProvider, message } from 'antd'; // 1. 额外导入 antd 的 App 和 message
import { MessageContext } from './components/MessageHook'; // 2. 导入我们创建的 Context
export const primaryThemeColor = "#F08080";

// 3. 创建一个包含所有 Provider 的顶层组件
const Root = () => {
  // 实例化 useMessage Hook
  const [messageApi, contextHolder] = message.useMessage();

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
          {/* 5. 挂载 contextHolder，这是让 message 生效的关键 */}
          {contextHolder}
          <App />
        </MessageContext.Provider>
      </ConfigProvider>
    </React.StrictMode>
  );
};


ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
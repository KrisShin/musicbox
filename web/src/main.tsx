import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import App from './App';
import './index.css';

// 自定义一个柔和的粉色主题
const theme = {
  token: {
    colorPrimary: '#e87997', // 一个优雅的粉色
  },
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      {/* AntdApp 用于提供 message, modal 等上下文 */}
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
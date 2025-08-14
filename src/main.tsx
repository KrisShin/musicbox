import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ConfigProvider } from "antd";


export const primaryThemeColor = "#F08080";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* 3. 使用 ConfigProvider 包裹你的整个应用 */}
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
      <App />
    </ConfigProvider>
  </React.StrictMode>
);

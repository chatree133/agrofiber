import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      locale={thTH}
      theme={{
        token: {
          colorPrimary: '#1f86f6',
          colorText: '#374151',
          colorTextBase: '#374151',
          colorTextHeading: '#374151',
          colorTextSecondary: '#4b5563',
          colorTextTertiary: '#6b7280',
          colorTextQuaternary: '#9ca3af',
          colorTextDisabled: '#9ca3af',
          colorTextPlaceholder: '#9ca3af',
          fontSize: 14,
          fontSizeLG: 15,
          fontSizeXL: 18,
          controlHeight: 34,
          controlHeightLG: 38,
          controlHeightSM: 28,
          padding: 12,
          paddingLG: 16,
          borderRadius: 8,
          fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif',
        },
        components: {
          Card: {
            headerFontSize: 16,
            headerFontSizeSM: 15,
            headerHeight: 48,
            headerHeightSM: 40,
            paddingLG: 16,
            paddingSM: 12,
          },
          Form: {
            itemMarginBottom: 14,
            labelFontSize: 14,
          },
          Table: {
            cellFontSize: 14,
            cellFontSizeSM: 13,
            cellPaddingBlock: 10,
            cellPaddingBlockSM: 8,
            cellPaddingInline: 12,
            cellPaddingInlineSM: 10,
            headerBorderRadius: 6,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);

import "./global.css";
import Script from 'next/script';

export const metadata = {
  title: "hub gpt",
  description: "the place to go for all your marketing questions!",
};

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <Script 
          src="https://cdn.jsdelivr.net/npm/emoji-mart@latest/dist/browser.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;

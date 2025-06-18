import "./global.css";

export const metadata = {
  title: "football gpt",
  description: "the place to go for all your football questions!",
};

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;

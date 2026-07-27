import './globals.css';

export const metadata = {
  title: 'GenTrack Admin',
  description: 'Dashboard admin GenTrack',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

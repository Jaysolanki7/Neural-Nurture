import { Toaster } from "react-hot-toast";
import Navigation from "@/components/Navigation";
import ClientWrapper from "@/components/ClientWrapper";
import "./globals.css";

export const metadata = {
  title: "Patient Care Portal",
  description: "MediAI Precision Healthcare",
};

export const viewport = {
  width: 'device-width',
  initialScale: 0.9,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <style dangerouslySetInnerHTML={{__html: `
          .material-symbols-outlined {
              font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
          .glass-card {
              background: rgba(255, 255, 255, 0.4);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
          }
          .gradient-text {
              background: linear-gradient(135deg, #4d5e8b 0%, #b4c5f9 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
          }
          .primary-gradient-btn {
              background: linear-gradient(135deg, #4d5e8b 0%, #b4c5f9 100%);
          }
        `}} />
      </head>
      <body className="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">
        <Toaster position="top-right" reverseOrder={false} />
        <Navigation />
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}

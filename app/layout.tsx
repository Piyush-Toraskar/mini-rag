import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mini RAG",
  description: "A small RAG app with hosted vector DB + retriever + reranker + citations."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}

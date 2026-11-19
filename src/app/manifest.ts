import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Konnekt — Your university, socially connected",
    short_name: "Konnekt",
    description:
      "The verified-students-only social network for Nigerian universities. Join your campus space, meet your department and stay connected.",
    start_url: "/pulse",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#147A57",
    lang: "en-NG",
    dir: "ltr",
    categories: ["social", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Home",
        short_name: "Home",
        description: "Your campus home",
        url: "/pulse",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My profile",
        short_name: "Profile",
        description: "Your Konnekt profile",
        url: "/profile/me",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Settings",
        short_name: "Settings",
        description: "Account and privacy settings",
        url: "/settings",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}

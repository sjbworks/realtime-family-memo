import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // typescript-eslint が TS7 の API に未対応なため、`typescript` は
    // @typescript/typescript6 に alias している。この bin は `tsc` ではなく `tsc6` で、
    // Next 16.3 で既定 true になった tsc CLI モードでは typescript 未インストール扱いになる。
    // TS6 は Compiler API (lib/typescript.js) を持つのでそちらを使う。
    // typescript-eslint が TS7 対応したら alias ごとこの設定も外せる。
    useTypeScriptCli: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

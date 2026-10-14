import {withWorkflow} from 'workflow/next';
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, experimental: {outputFileTracingIncludes: {'/api/ai-video/post*':['./node_modules/ffmpeg-static/ffmpeg'],'/.well-known/workflow/**':['./node_modules/ffmpeg-static/ffmpeg'],'/api/live-studio/backdrop':['./public/live-studio/ali-isti.webp'],'/api/live-studio/npc':['./public/live-studio/ali-isti-masked.webp','./public/live-studio/ali-isti-standing.webp','./node_modules/ffmpeg-static/ffmpeg']}} };
export default withWorkflow(nextConfig);

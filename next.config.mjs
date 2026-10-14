import {withWorkflow} from 'workflow/next';
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, experimental: {outputFileTracingIncludes: {'/api/ai-video/post*':['./node_modules/ffmpeg-static/ffmpeg'],'/.well-known/workflow/**':['./node_modules/ffmpeg-static/ffmpeg'],'/api/live-studio/backdrop':['./public/live-studio/ali-isti.webp'],'/api/live-studio/npc':['./public/live-studio/ali-isti-masked.webp']}} };
export default withWorkflow(nextConfig);

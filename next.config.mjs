import {withWorkflow} from 'workflow/next';
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, experimental: {outputFileTracingIncludes: {'/api/ai-video/post*':['./node_modules/ffmpeg-static/ffmpeg'],'/.well-known/workflow/**':['./node_modules/ffmpeg-static/ffmpeg']}} };
export default withWorkflow(nextConfig);

/* eslint-disable @typescript-eslint/no-explicit-any */
import mod from '../dist/serverless.js';

const handler = (mod as any).default ?? mod;

export default handler;
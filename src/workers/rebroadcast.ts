const ENABLE_WORKERS = (process.env.ENABLE_WORKERS || 'false').toLowerCase() === 'true';
export function rebroadcast(_evt: any) {
	if (!ENABLE_WORKERS) return;
	// would publish to redis or queues here when enabled
}
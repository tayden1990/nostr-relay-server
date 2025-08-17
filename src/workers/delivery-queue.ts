const ENABLE_WORKERS = (process.env.ENABLE_WORKERS || 'false').toLowerCase() === 'true';
let queue: any;
export function addToDeliveryQueue(_msg: any) {
	if (!ENABLE_WORKERS) return;
	if (!queue) {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const Bull = require('bull');
		queue = new Bull('deliveryQueue');
	}
	queue.add(_msg);
}
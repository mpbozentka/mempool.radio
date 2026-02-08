/** Normalize API tx to { txid, value (sats), feeRate, vsize, fee } for the app. */
function normalizeTx(tx: any): any {
  const txid = tx.txid || tx.id;
  let value = tx.value;
  if (value === undefined && tx.vout && Array.isArray(tx.vout)) {
    value = tx.vout.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  }
  if (value === undefined && tx.vsize) value = tx.vsize * 120;
  if (value === undefined) value = 10000;
  const vsize = tx.vsize ?? tx.weight / 4;
  const fee = tx.fee ?? 0;
  const feeRate = vsize > 0 ? fee / vsize : 1;
  return { txid, id: txid, value, feeRate, vsize, fee, ...tx };
}

/** Normalize API block to app Block shape. */
function normalizeBlock(block: any): any {
  if (!block) return null;
  return {
    id: block.id ?? block.hash ?? block.block_hash ?? '',
    height: block.height ?? block.block_height ?? 0,
    timestamp: block.timestamp ?? block.block_time ?? block.time ?? Math.floor(Date.now() / 1000),
    tx_count: block.tx_count ?? block.nTx ?? block.txCount ?? 0,
    size: block.size ?? block.blockSize ?? 0,
    weight: block.weight ?? block.blockWeight ?? 0
  };
}

/** Map mempoolInfo (or stats) to app MempoolStats. total_fee from API can be BTC. */
function normalizeStats(data: any): any {
  if (!data) return null;
  const count = data.count ?? data.size ?? 0;
  const vsize = data.vsize ?? data.bytes ?? 0;
  let total_fee = data.total_fee ?? 0;
  if (total_fee > 0 && total_fee < 100000000) total_fee = Math.round(total_fee * 100000000);
  return { count, vsize, total_fee: Math.round(total_fee) };
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export class MempoolSocket {
  private ws: WebSocket | null = null;
  private url = 'wss://mempool.space/api/v1/ws';
  private onTransaction: (tx: any) => void;
  private onBlock: (block: any) => void;
  private onStats: (stats: any) => void;
  private onStatus?: (status: ConnectionStatus) => void;
  private reconnectTimeout: number | null = null;

  constructor(
    onTransaction: (tx: any) => void,
    onBlock: (block: any) => void,
    onStats: (stats: any) => void,
    onStatus?: (status: ConnectionStatus) => void
  ) {
    this.onTransaction = onTransaction;
    this.onBlock = onBlock;
    this.onStats = onStats;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.onStatus?.('connecting');
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Mempool.fm: WebSocket connected');
        this.onStatus?.('connected');
        // General live data: blocks, stats, mempool-blocks
        this.ws?.send(JSON.stringify({ action: 'want', data: ['blocks', 'stats', 'mempool-blocks'] }));
        this.ws?.send(JSON.stringify({ 'track-mempool': true }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message['block']) {
            const block = normalizeBlock(message['block']);
            if (block) this.onBlock(block);
          }

          if (message['stats']) {
            const stats = normalizeStats(message['stats']);
            if (stats) this.onStats(stats);
          }
          if (message['mempoolInfo']) {
            const info = message['mempoolInfo'];
            const stats = normalizeStats({
              count: info.size,
              vsize: info.bytes,
              total_fee: info.total_fee
            });
            if (stats) this.onStats(stats);
          }

          if (message['mempool-blocks']) {
            // Optional: use for mempool block info
          }

          // Live mempool transactions: mempool-transactions.added (array of full tx objects)
          const mempoolTx = message['mempool-transactions'];
          if (mempoolTx && mempoolTx.added && Array.isArray(mempoolTx.added)) {
            mempoolTx.added.forEach((tx: any) => this.onTransaction(normalizeTx(tx)));
          }

          if (message['tx']) {
            this.onTransaction(normalizeTx(message['tx']));
          }

          if (message['transactions'] && Array.isArray(message['transactions'])) {
            message['transactions'].forEach((tx: any) => this.onTransaction(normalizeTx(tx)));
          }

          if (message.txid && message.value !== undefined) {
            this.onTransaction(normalizeTx(message));
          }
        } catch (e) {
          console.error('Mempool.fm: Parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.onStatus?.('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = window.setTimeout(() => this.connect(), 5000);
    }
  }

  disconnect() {
    this.onStatus?.('disconnected');
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

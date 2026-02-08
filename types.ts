
export interface Transaction {
  id: string;
  value: number; // in Satoshis
  fee: number; // in Satoshis
  vsize: number;
  feeRate: number; // sat/vB
  timestamp: number;
}

export interface Block {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
}

export interface MempoolStats {
  count: number;
  vsize: number;
  total_fee: number;
}

export interface AppState {
  btcPrice: number;
  lastBlock?: Block;
  isAudioStarted: boolean;
  volume: number;
  mempoolStats: MempoolStats;
}

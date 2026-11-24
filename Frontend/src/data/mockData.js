/**
 * Mock data matching the XAI-NIDS reference dashboard
 */

export const dashboardStats = {
  totalPredictions: {
    value: "1,248",
    change: "+12.5%",
    isPositive: true,
    label: "Total Predictions",
  },
  normalTraffic: {
    value: "829",
    percentage: "66.4%",
    label: "Normal Traffic",
  },
  maliciousTraffic: {
    value: "419",
    percentage: "33.6%",
    label: "Malicious Traffic",
  },
  avgConfidence: {
    value: "0.86",
    change: "+4.2%",
    isPositive: true,
    label: "Avg. Confidence",
  },
};

export const attackDistributionData = [
  { name: 'DoS', value: 115, percentage: 27.4, color: '#F43F5E' }, // Coral pink/red
  { name: 'Generic', value: 76, percentage: 18.1, color: '#A855F7' }, // Purple
  { name: 'Exploits', value: 60, percentage: 14.3, color: '#3B82F6' }, // Blue
  { name: 'Fuzzers', value: 49, percentage: 11.7, color: '#10B981' }, // Emerald
  { name: 'Reconnaissance', value: 44, percentage: 10.5, color: '#06B6D4' }, // Cyan
  { name: 'Analysis', value: 26, percentage: 6.2, color: '#EAB308' }, // Yellow
  { name: 'Backdoor', value: 21, percentage: 5.0, color: '#F97316' }, // Orange
  { name: 'Others', value: 28, percentage: 6.8, color: '#64748B' }, // Slate
];

export const trafficTrendData = [
  { date: 'Jan 20', normal: 95, malicious: 48 },
  { date: 'Jan 21', normal: 135, malicious: 68 },
  { date: 'Jan 22', normal: 120, malicious: 55 },
  { date: 'Jan 23', normal: 155, malicious: 72 },
  { date: 'Jan 24', normal: 145, malicious: 60 },
  { date: 'Jan 25', normal: 190, malicious: 92 },
  { date: 'Jan 26', normal: 180, malicious: 88 },
];

export const latestPrediction = {
  id: '#PRD-1048',
  status: 'Malicious',
  attackCategory: 'DoS',
  confidence: 0.94,
  timestamp: 'Jan 26, 2025, 14:32',
};

export const shapPreviewData = [
  { feature: 'sload', value: 0.28, type: 'positive' },
  { feature: 'dload', value: 0.21, type: 'positive' },
  { feature: 'ct_srv_src', value: 0.17, type: 'positive' },
  { feature: 'dur', value: -0.12, type: 'negative' },
  { feature: 'sttl', value: -0.10, type: 'negative' },
];

export const recentPredictions = [
  {
    id: 'PRD-1048',
    time: 'Jan 26, 2025, 14:32',
    result: 'Malicious',
    attackCategory: 'DoS',
    confidence: 0.94,
    proto: 'udp',
    service: 'dns',
    sbytes: 146,
    dbytes: 178,
  },
  {
    id: 'PRD-1047',
    time: 'Jan 26, 2025, 14:28',
    result: 'Normal',
    attackCategory: 'Normal',
    confidence: 0.91,
    proto: 'tcp',
    service: 'http',
    sbytes: 354,
    dbytes: 2890,
  },
  {
    id: 'PRD-1046',
    time: 'Jan 26, 2025, 14:17',
    result: 'Malicious',
    attackCategory: 'Exploits',
    confidence: 0.89,
    proto: 'rdp',
    service: '-',
    sbytes: 200,
    dbytes: 0,
  },
  {
    id: 'PRD-1045',
    time: 'Jan 26, 2025, 14:10',
    result: 'Normal',
    attackCategory: 'Normal',
    confidence: 0.87,
    proto: 'tcp',
    service: 'ssl',
    sbytes: 1520,
    dbytes: 4890,
  },
  {
    id: 'PRD-1044',
    time: 'Jan 26, 2025, 13:58',
    result: 'Malicious',
    attackCategory: 'Generic',
    confidence: 0.92,
    proto: 'udp',
    service: '-',
    sbytes: 980,
    dbytes: 120,
  },
  {
    id: 'PRD-1043',
    time: 'Jan 26, 2025, 13:45',
    result: 'Malicious',
    attackCategory: 'Fuzzers',
    confidence: 0.85,
    proto: 'tcp',
    service: 'ftp',
    sbytes: 420,
    dbytes: 512,
  },
  {
    id: 'PRD-1042',
    time: 'Jan 26, 2025, 13:30',
    result: 'Normal',
    attackCategory: 'Normal',
    confidence: 0.96,
    proto: 'udp',
    service: 'dns',
    sbytes: 78,
    dbytes: 110,
  },
  {
    id: 'PRD-1041',
    time: 'Jan 26, 2025, 13:12',
    result: 'Malicious',
    attackCategory: 'Reconnaissance',
    confidence: 0.88,
    proto: 'tcp',
    service: 'smtp',
    sbytes: 650,
    dbytes: 890,
  },
];

export const globalFeatureImportance = [
  { rank: 1, feature: 'cat__proto_udp', importance: 0.6636, category: 'Protocol' },
  { rank: 2, feature: 'num__sttl', importance: 0.5489, category: 'TTL' },
  { rank: 3, feature: 'cat__state_INT', importance: 0.4820, category: 'State' },
  { rank: 4, feature: 'num__sbytes', importance: 0.4215, category: 'Volume' },
  { rank: 5, feature: 'num__sload', importance: 0.3892, category: 'Throughput' },
  { rank: 6, feature: 'num__rate', importance: 0.3541, category: 'Rate' },
  { rank: 7, feature: 'num__dttl', importance: 0.3120, category: 'TTL' },
  { rank: 8, feature: 'num__ct_state_ttl', importance: 0.2894, category: 'Count' },
  { rank: 9, feature: 'cat__service_-', importance: 0.2547, category: 'Service' },
  { rank: 10, feature: 'num__sinpkt', importance: 0.2215, category: 'Timing' },
  { rank: 11, feature: 'num__smean', importance: 0.1984, category: 'Packet Size' },
  { rank: 12, feature: 'num__ct_dst_src_ltm', importance: 0.1843, category: 'Connection' },
  { rank: 13, feature: 'num__dload', importance: 0.1712, category: 'Throughput' },
  { rank: 14, feature: 'num__ct_srv_dst', importance: 0.1589, category: 'Count' },
  { rank: 15, feature: 'num__ct_srv_src', importance: 0.1456, category: 'Count' },
  { rank: 16, feature: 'num__dpkts', importance: 0.1342, category: 'Packet Count' },
  { rank: 17, feature: 'num__spkts', importance: 0.1218, category: 'Packet Count' },
  { rank: 18, feature: 'cat__state_FIN', importance: 0.1095, category: 'State' },
  { rank: 19, feature: 'num__dmean', importance: 0.0984, category: 'Packet Size' },
  { rank: 20, feature: 'num__dur', importance: 0.0876, category: 'Duration' },
];

export const samplePresets = [
  {
    name: 'Exploits (RDP brute force/attempt)',
    data: {
      dur: 0.000002, proto: 'rdp', service: '-', state: 'INT', spkts: 2, dpkts: 0,
      sbytes: 200, dbytes: 0, rate: 500000.0013, sttl: 254, dttl: 0, sload: 400000000.0,
      dload: 0.0, sloss: 0, dloss: 0, sinpkt: 0.002, dinpkt: 0.0, sjit: 0.0, djit: 0.0,
      swin: 0, stcpb: 0, dtcpb: 0, dwin: 0, tcprtt: 0.0, synack: 0.0, ackdat: 0.0,
      smean: 100, dmean: 0, trans_depth: 0, response_body_len: 0, ct_srv_src: 6,
      ct_state_ttl: 2, ct_dst_ltm: 3, ct_src_dport_ltm: 3, ct_dst_sport_ltm: 3,
      ct_dst_src_ltm: 6, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 0,
      ct_src_ltm: 3, ct_srv_dst: 6, is_sm_ips_ports: 0
    }
  },
  {
    name: 'Normal Web Traffic (HTTP GET)',
    data: {
      dur: 0.121478, proto: 'tcp', service: 'http', state: 'FIN', spkts: 6, dpkts: 8,
      sbytes: 258, dbytes: 4022, rate: 107.0152, sttl: 31, dttl: 29, sload: 14751.64,
      dload: 234567.8, sloss: 0, dloss: 0, sinpkt: 24.29, dinpkt: 17.35, sjit: 13.9, djit: 14.2,
      swin: 255, stcpb: 110283, dtcpb: 110284, dwin: 255, tcprtt: 0.0008, synack: 0.0004,
      ackdat: 0.0004, smean: 43, dmean: 503, trans_depth: 1, response_body_len: 268,
      ct_srv_src: 1, ct_state_ttl: 0, ct_dst_ltm: 1, ct_src_dport_ltm: 1, ct_dst_sport_ltm: 1,
      ct_dst_src_ltm: 1, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 1,
      ct_src_ltm: 1, ct_srv_dst: 1, is_sm_ips_ports: 0
    }
  },
  {
    name: 'DoS Attack (UDP Flood)',
    data: {
      dur: 0.000004, proto: 'udp', service: 'dns', state: 'INT', spkts: 2, dpkts: 0,
      sbytes: 146, dbytes: 0, rate: 250000.0, sttl: 254, dttl: 0, sload: 146000000.0,
      dload: 0.0, sloss: 0, dloss: 0, sinpkt: 0.004, dinpkt: 0.0, sjit: 0.0, djit: 0.0,
      swin: 0, stcpb: 0, dtcpb: 0, dwin: 0, tcprtt: 0.0, synack: 0.0, ackdat: 0.0,
      smean: 73, dmean: 0, trans_depth: 0, response_body_len: 0, ct_srv_src: 15,
      ct_state_ttl: 2, ct_dst_ltm: 12, ct_src_dport_ltm: 12, ct_dst_sport_ltm: 8,
      ct_dst_src_ltm: 15, is_ftp_login: 0, ct_ftp_cmd: 0, ct_flw_http_mthd: 0,
      ct_src_ltm: 12, ct_srv_dst: 15, is_sm_ips_ports: 0
    }
  }
];


/**
 * Metadata and validation schema for the 42 raw features from UNSW-NB15 dataset.
 * Matches exact FastAPI PredictionRequest schema.
 */

export const FEATURE_GROUPS = [
  { id: 'all', label: 'All Features (42)' },
  { id: 'basic', label: 'Protocol & Basic (5)' },
  { id: 'content', label: 'Packet & Content (12)' },
  { id: 'tcp', label: 'TCP & Timing (13)' },
  { id: 'flow', label: 'Flow & Counts (12)' },
];

export const FEATURES_METADATA = [
  // 1. Basic & Protocol (5)
  {
    name: 'proto',
    type: 'str',
    group: 'basic',
    label: 'Protocol',
    description: 'Transaction protocol (e.g. tcp, udp, rdp, unas, icmp)',
  },
  {
    name: 'service',
    type: 'str',
    group: 'basic',
    label: 'Service',
    description: 'Network service (e.g. -, http, ftp, dns, smtp, ssh)',
  },
  {
    name: 'state',
    type: 'str',
    group: 'basic',
    label: 'State',
    description: 'Connection state (e.g. FIN, INT, CON, REQ, RST)',
  },
  {
    name: 'dur',
    type: 'float',
    group: 'basic',
    label: 'Duration',
    description: 'Record total duration (seconds)',
  },
  {
    name: 'rate',
    type: 'float',
    group: 'basic',
    label: 'Rate',
    description: 'Packets per second (pps)',
  },

  // 2. Packet & Content (12)
  {
    name: 'spkts',
    type: 'int',
    group: 'content',
    label: 'Source Packets',
    description: 'Source to destination packet count',
  },
  {
    name: 'dpkts',
    type: 'int',
    group: 'content',
    label: 'Dest Packets',
    description: 'Destination to source packet count',
  },
  {
    name: 'sbytes',
    type: 'int',
    group: 'content',
    label: 'Source Bytes',
    description: 'Source to destination transaction bytes',
  },
  {
    name: 'dbytes',
    type: 'int',
    group: 'content',
    label: 'Dest Bytes',
    description: 'Destination to source transaction bytes',
  },
  {
    name: 'sload',
    type: 'float',
    group: 'content',
    label: 'Source Load',
    description: 'Source bits per second',
  },
  {
    name: 'dload',
    type: 'float',
    group: 'content',
    label: 'Dest Load',
    description: 'Destination bits per second',
  },
  {
    name: 'sloss',
    type: 'int',
    group: 'content',
    label: 'Source Loss',
    description: 'Source packets retransmitted or dropped',
  },
  {
    name: 'dloss',
    type: 'int',
    group: 'content',
    label: 'Dest Loss',
    description: 'Destination packets retransmitted or dropped',
  },
  {
    name: 'smean',
    type: 'int',
    group: 'content',
    label: 'Source Mean Size',
    description: 'Mean packet size transmitted by source',
  },
  {
    name: 'dmean',
    type: 'int',
    group: 'content',
    label: 'Dest Mean Size',
    description: 'Mean packet size transmitted by destination',
  },
  {
    name: 'trans_depth',
    type: 'int',
    group: 'content',
    label: 'Trans Depth',
    description: 'Pipelined HTTP request/response count',
  },
  {
    name: 'response_body_len',
    type: 'int',
    group: 'content',
    label: 'Response Body Len',
    description: 'Actual uncompressed content size of HTTP response',
  },

  // 3. TCP & Timing (13)
  {
    name: 'sttl',
    type: 'int',
    group: 'tcp',
    label: 'Source TTL',
    description: 'Source to destination time to live value',
  },
  {
    name: 'dttl',
    type: 'int',
    group: 'tcp',
    label: 'Dest TTL',
    description: 'Destination to source time to live value',
  },
  {
    name: 'sinpkt',
    type: 'float',
    group: 'tcp',
    label: 'Source Interpacket',
    description: 'Source interpacket arrival time (mSec)',
  },
  {
    name: 'dinpkt',
    type: 'float',
    group: 'tcp',
    label: 'Dest Interpacket',
    description: 'Destination interpacket arrival time (mSec)',
  },
  {
    name: 'sjit',
    type: 'float',
    group: 'tcp',
    label: 'Source Jitter',
    description: 'Source jitter (mSec)',
  },
  {
    name: 'djit',
    type: 'float',
    group: 'tcp',
    label: 'Dest Jitter',
    description: 'Destination jitter (mSec)',
  },
  {
    name: 'swin',
    type: 'int',
    group: 'tcp',
    label: 'Source Window',
    description: 'Source TCP window advertisement value',
  },
  {
    name: 'stcpb',
    type: 'int',
    group: 'tcp',
    label: 'Source TCP Base',
    description: 'Source TCP base sequence number',
  },
  {
    name: 'dtcpb',
    type: 'int',
    group: 'tcp',
    label: 'Dest TCP Base',
    description: 'Destination TCP base sequence number',
  },
  {
    name: 'dwin',
    type: 'int',
    group: 'tcp',
    label: 'Dest Window',
    description: 'Destination TCP window advertisement value',
  },
  {
    name: 'tcprtt',
    type: 'float',
    group: 'tcp',
    label: 'TCP RTT',
    description: 'TCP round trip time (seconds), sum of synack and ackdat',
  },
  {
    name: 'synack',
    type: 'float',
    group: 'tcp',
    label: 'TCP SYN-ACK',
    description: 'TCP connection setup time (syn to syn-ack)',
  },
  {
    name: 'ackdat',
    type: 'float',
    group: 'tcp',
    label: 'TCP ACK-DAT',
    description: 'TCP connection setup time (syn-ack to ack)',
  },

  // 4. Flow & Connection Counts (12)
  {
    name: 'ct_srv_src',
    type: 'int',
    group: 'flow',
    label: 'Count Srv Src',
    description: 'Connections with same service and source in 100 records',
  },
  {
    name: 'ct_state_ttl',
    type: 'int',
    group: 'flow',
    label: 'Count State TTL',
    description: 'Connections according to state and TTL ranges',
  },
  {
    name: 'ct_dst_ltm',
    type: 'int',
    group: 'flow',
    label: 'Count Dst LTM',
    description: 'Connections to destination address in last 100 records',
  },
  {
    name: 'ct_src_dport_ltm',
    type: 'int',
    group: 'flow',
    label: 'Count Src Dport LTM',
    description: 'Connections from source to destination port in 100 records',
  },
  {
    name: 'ct_dst_sport_ltm',
    type: 'int',
    group: 'flow',
    label: 'Count Dst Sport LTM',
    description: 'Connections from destination to source port in 100 records',
  },
  {
    name: 'ct_dst_src_ltm',
    type: 'int',
    group: 'flow',
    label: 'Count Dst Src LTM',
    description: 'Connections with same source and destination in 100 records',
  },
  {
    name: 'is_ftp_login',
    type: 'int',
    group: 'flow',
    label: 'Is FTP Login',
    description: '1 if FTP session accessed by user/password, 0 otherwise',
  },
  {
    name: 'ct_ftp_cmd',
    type: 'int',
    group: 'flow',
    label: 'Count FTP Cmd',
    description: 'Number of flow commands in FTP session',
  },
  {
    name: 'ct_flw_http_mthd',
    type: 'int',
    group: 'flow',
    label: 'Count HTTP Method',
    description: 'Number of flows that use HTTP methods (GET, POST)',
  },
  {
    name: 'ct_src_ltm',
    type: 'int',
    group: 'flow',
    label: 'Count Src LTM',
    description: 'Connections to source address in last 100 records',
  },
  {
    name: 'ct_srv_dst',
    type: 'int',
    group: 'flow',
    label: 'Count Srv Dst',
    description: 'Connections with same service and destination in 100 records',
  },
  {
    name: 'is_sm_ips_ports',
    type: 'int',
    group: 'flow',
    label: 'Same IP & Ports',
    description: '1 if source and destination IP and port equal, 0 otherwise',
  },
];

/**
 * Validates and transforms the 42 raw feature values
 * @param {Object} rawData - Object of feature key-values
 * @returns {{ isValid: boolean, errors: Object, payload: Object }}
 */
export const validateFeaturePayload = (rawData) => {
  const errors = {};
  const payload = {};

  if (!rawData || typeof rawData !== 'object') {
    return {
      isValid: false,
      errors: { _general: 'Form data must be a valid object containing 42 features.' },
      payload: {},
    };
  }

  for (const meta of FEATURES_METADATA) {
    const rawVal = rawData[meta.name];

    // Check presence
    if (rawVal === undefined || rawVal === null || (typeof rawVal === 'string' && rawVal.trim() === '')) {
      errors[meta.name] = `${meta.name} is required`;
      continue;
    }

    if (meta.type === 'str') {
      const strVal = String(rawVal).trim();
      if (!strVal) {
        errors[meta.name] = `${meta.name} must not be empty`;
      } else {
        payload[meta.name] = strVal;
      }
    } else if (meta.type === 'int') {
      const numVal = Number(rawVal);
      if (isNaN(numVal) || !Number.isFinite(numVal)) {
        errors[meta.name] = `${meta.name} must be a valid number`;
      } else if (!Number.isInteger(numVal)) {
        // Round or reject
        payload[meta.name] = Math.round(numVal);
      } else if (numVal < 0) {
        errors[meta.name] = `${meta.name} cannot be negative`;
      } else {
        payload[meta.name] = numVal;
      }
    } else if (meta.type === 'float') {
      const floatVal = Number(rawVal);
      if (isNaN(floatVal) || !Number.isFinite(floatVal)) {
        errors[meta.name] = `${meta.name} must be a valid finite number`;
      } else if (floatVal < 0) {
        errors[meta.name] = `${meta.name} cannot be negative`;
      } else {
        payload[meta.name] = floatVal;
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors, payload };
};

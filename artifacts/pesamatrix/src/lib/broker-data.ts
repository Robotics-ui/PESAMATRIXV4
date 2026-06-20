export interface BrokerServer {
  name: string;
  type: "real" | "demo";
}

export interface Broker {
  name: string;
  servers: BrokerServer[];
}

export const BROKERS: Broker[] = [
  {
    name: "IC Markets",
    servers: [
      { name: "ICMarkets-Live01", type: "real" },
      { name: "ICMarkets-Live02", type: "real" },
      { name: "ICMarkets-Live03", type: "real" },
      { name: "ICMarkets-Demo", type: "demo" },
      { name: "ICMarkets-Demo02", type: "demo" },
    ],
  },
  {
    name: "Pepperstone",
    servers: [
      { name: "Pepperstone-MT5-Live01", type: "real" },
      { name: "Pepperstone-MT5-Live02", type: "real" },
      { name: "Pepperstone-MT5-Demo01", type: "demo" },
    ],
  },
  {
    name: "Exness",
    servers: [
      { name: "Exness-Real", type: "real" },
      { name: "Exness-Real2", type: "real" },
      { name: "Exness-Real3", type: "real" },
      { name: "Exness-Real4", type: "real" },
      { name: "Exness-Real5", type: "real" },
      { name: "Exness-Demo", type: "demo" },
      { name: "Exness-Demo2", type: "demo" },
    ],
  },
  {
    name: "XM",
    servers: [
      { name: "XMGlobal-Real", type: "real" },
      { name: "XMGlobal-Real2", type: "real" },
      { name: "XMGlobal-Real3", type: "real" },
      { name: "XMGlobal-Demo", type: "demo" },
      { name: "XMGlobal-Demo2", type: "demo" },
    ],
  },
  {
    name: "FP Markets",
    servers: [
      { name: "FPMarkets-Live01", type: "real" },
      { name: "FPMarkets-Live02", type: "real" },
      { name: "FPMarkets-Demo01", type: "demo" },
    ],
  },
  {
    name: "FTMO",
    servers: [
      { name: "FTMO-Demo", type: "demo" },
      { name: "FTMO-Demo2", type: "demo" },
      { name: "FTMO-Demo3", type: "demo" },
    ],
  },
  {
    name: "HFM (HotForex)",
    servers: [
      { name: "HFMarkets-Live Server 2", type: "real" },
      { name: "HFMarkets-Live Server 3", type: "real" },
      { name: "HFMarkets-Demo Server 2", type: "demo" },
    ],
  },
  {
    name: "Tickmill",
    servers: [
      { name: "Tickmill-Live", type: "real" },
      { name: "Tickmill-Live2", type: "real" },
      { name: "Tickmill-Demo", type: "demo" },
    ],
  },
  {
    name: "Vantage",
    servers: [
      { name: "Vantage-Real", type: "real" },
      { name: "Vantage-Real2", type: "real" },
      { name: "Vantage-Demo", type: "demo" },
    ],
  },
  {
    name: "EightCap",
    servers: [
      { name: "EightCap-Live01", type: "real" },
      { name: "EightCap-Live02", type: "real" },
      { name: "EightCap-Demo01", type: "demo" },
    ],
  },
  {
    name: "ThinkMarkets",
    servers: [
      { name: "ThinkMarkets-Live01", type: "real" },
      { name: "ThinkMarkets-Live02", type: "real" },
      { name: "ThinkMarkets-Demo01", type: "demo" },
    ],
  },
  {
    name: "Axiory",
    servers: [
      { name: "Axiory-Live", type: "real" },
      { name: "Axiory-Demo", type: "demo" },
    ],
  },
  {
    name: "RoboForex",
    servers: [
      { name: "RoboForex-ECN", type: "real" },
      { name: "RoboForex-Pro", type: "real" },
      { name: "RoboForex-Demo", type: "demo" },
    ],
  },
  {
    name: "Admirals",
    servers: [
      { name: "Admirals-Live", type: "real" },
      { name: "Admirals-Live2", type: "real" },
      { name: "Admirals-Demo", type: "demo" },
    ],
  },
  {
    name: "FxPro",
    servers: [
      { name: "FxPro-MT5 Real", type: "real" },
      { name: "FxPro-MT5 Real2", type: "real" },
      { name: "FxPro-MT5 Demo", type: "demo" },
    ],
  },
  {
    name: "AvaTrade",
    servers: [
      { name: "AvaTrade-MT5-Real", type: "real" },
      { name: "AvaTrade-MT5-Demo", type: "demo" },
    ],
  },
  {
    name: "Deriv",
    servers: [
      { name: "Deriv-Server", type: "real" },
      { name: "Deriv-Server-02", type: "real" },
      { name: "Deriv-Demo Server", type: "demo" },
    ],
  },
  {
    name: "OctaFX",
    servers: [
      { name: "OctaFX-Real", type: "real" },
      { name: "OctaFX-Demo", type: "demo" },
    ],
  },
  {
    name: "FBS",
    servers: [
      { name: "FBS-Real", type: "real" },
      { name: "FBS-Demo", type: "demo" },
    ],
  },
  {
    name: "FXTM",
    servers: [
      { name: "ForexTime-MT5 Real", type: "real" },
      { name: "ForexTime-MT5 Demo", type: "demo" },
    ],
  },
  {
    name: "LiteFinance",
    servers: [
      { name: "LiteFinance-Real", type: "real" },
      { name: "LiteFinance-Demo", type: "demo" },
    ],
  },
  {
    name: "BlackBull Markets",
    servers: [
      { name: "BlackBull-Live", type: "real" },
      { name: "BlackBull-Demo", type: "demo" },
    ],
  },
  {
    name: "Axi",
    servers: [
      { name: "Axi-MT5 Live", type: "real" },
      { name: "Axi-MT5 Demo", type: "demo" },
    ],
  },
  {
    name: "Global Prime",
    servers: [
      { name: "GlobalPrime-Live", type: "real" },
      { name: "GlobalPrime-Demo", type: "demo" },
    ],
  },
  {
    name: "Fusion Markets",
    servers: [
      { name: "FusionMarkets-Live01", type: "real" },
      { name: "FusionMarkets-Demo01", type: "demo" },
    ],
  },
  {
    name: "GO Markets",
    servers: [
      { name: "GOMarkets-Live01", type: "real" },
      { name: "GOMarkets-Demo01", type: "demo" },
    ],
  },
  {
    name: "Equiti",
    servers: [
      { name: "Equiti-Live", type: "real" },
      { name: "Equiti-Demo", type: "demo" },
    ],
  },
  {
    name: "FXCM",
    servers: [
      { name: "FXCM-USDReal02", type: "real" },
      { name: "FXCM-USDReal03", type: "real" },
      { name: "FXCM-USDDemo02", type: "demo" },
    ],
  },
  {
    name: "Swissquote",
    servers: [
      { name: "Swissquote-MT5 Real", type: "real" },
      { name: "Swissquote-MT5 Demo", type: "demo" },
    ],
  },
  {
    name: "OANDA",
    servers: [
      { name: "OANDA-v20 Live-1", type: "real" },
      { name: "OANDA-v20 Practice", type: "demo" },
    ],
  },
  {
    name: "Alpari",
    servers: [
      { name: "Alpari-MT5 Real", type: "real" },
      { name: "Alpari-MT5 Demo", type: "demo" },
    ],
  },
  {
    name: "InstaForex",
    servers: [
      { name: "InstaForex-Server", type: "real" },
      { name: "InstaForex-Demo Server", type: "demo" },
    ],
  },
  {
    name: "NAGA",
    servers: [
      { name: "NAGA-Live", type: "real" },
      { name: "NAGA-Demo", type: "demo" },
    ],
  },
  {
    name: "Trading 212",
    servers: [
      { name: "Trading212-Live", type: "real" },
      { name: "Trading212-Demo", type: "demo" },
    ],
  },
  {
    name: "Weltrade",
    servers: [
      { name: "Weltrade-Live", type: "real" },
      { name: "Weltrade-Demo", type: "demo" },
    ],
  },
  {
    name: "ACY Securities",
    servers: [
      { name: "ACYSecurities-Live", type: "real" },
      { name: "ACYSecurities-Demo", type: "demo" },
    ],
  },
  {
    name: "Moneta Markets",
    servers: [
      { name: "MonetaMarkets-Live", type: "real" },
      { name: "MonetaMarkets-Demo", type: "demo" },
    ],
  },
  {
    name: "Just Markets",
    servers: [
      { name: "JustMarkets-Live", type: "real" },
      { name: "JustMarkets-Demo", type: "demo" },
    ],
  },
];

export const ALL_BROKER_NAMES = BROKERS.map((b) => b.name);

export function getServersForBroker(brokerName: string): BrokerServer[] {
  const broker = BROKERS.find(
    (b) => b.name.toLowerCase() === brokerName.toLowerCase()
  );
  return broker?.servers ?? [];
}

export function getAllServers(): BrokerServer[] {
  return BROKERS.flatMap((b) => b.servers);
}

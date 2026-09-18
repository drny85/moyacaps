export interface CarrierInfo {
  id: string;
  name: string;
  urlTemplate: (trackingNumber: string) => string;
}

export const SUPPORTED_CARRIERS: CarrierInfo[] = [
  {
    id: "usps",
    name: "USPS",
    urlTemplate: (trk) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trk)}`,
  },
  {
    id: "ups",
    name: "UPS",
    urlTemplate: (trk) => `https://www.ups.com/track?tracknum=${encodeURIComponent(trk)}`,
  },
  {
    id: "fedex",
    name: "FedEx",
    urlTemplate: (trk) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trk)}`,
  },
  {
    id: "dhl",
    name: "DHL Express",
    urlTemplate: (trk) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trk)}`,
  },
  {
    id: "estafeta",
    name: "Estafeta Express",
    urlTemplate: (trk) => `https://www.estafeta.com/Herramientas/Rastreo?trackingNumber=${encodeURIComponent(trk)}`,
  },
  {
    id: "correos",
    name: "Correos de México",
    urlTemplate: () => `https://www.correosdemexico.gob.mx/SSLServicios/SeguimientoEnvio/Seguimiento.aspx`,
  },
];

export function getCarrierTrackingUrl(carrier?: string, trackingNumber?: string): string | null {
  if (!trackingNumber || trackingNumber.trim() === "") return null;
  const cleanTrk = trackingNumber.trim();
  const cleanCarrier = (carrier || "").toLowerCase();

  if (cleanCarrier.includes("usps") || cleanCarrier.includes("postal")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("dhl")) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("estafeta")) {
    return `https://www.estafeta.com/Herramientas/Rastreo?trackingNumber=${encodeURIComponent(cleanTrk)}`;
  }
  if (cleanCarrier.includes("correos")) {
    return `https://www.correosdemexico.gob.mx/SSLServicios/SeguimientoEnvio/Seguimiento.aspx`;
  }

  // Fallback direct parcel search
  return `https://parcelsapp.com/en/tracking/${encodeURIComponent(cleanTrk)}`;
}

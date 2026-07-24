// Product types fulfilled as a code/digital asset rather than a physical
// shipment — e.g. gift cards. Drives which delivery messaging a PDP shows.
const DIGITAL_PRODUCT_TYPES = ["Gift Cards"];

export function isDigitalProduct(productType: string): boolean {
  return DIGITAL_PRODUCT_TYPES.includes(productType);
}

import React from 'react';
import { TextCustomizationSettings } from '../services/templateService';

/**
 * Converts TextCustomizationSettings to a standard CSS style object.
 * Integrates fallback/default styles seamlessly.
 */
export function applyTextSettings(
  settings: TextCustomizationSettings | undefined,
  defaultStyles: React.CSSProperties = {}
): React.CSSProperties {
  if (!settings) {
    return defaultStyles;
  }

  const styles: React.CSSProperties = { ...defaultStyles };

  // Typography
  if (settings.fontSize !== undefined && settings.fontSize > 0) {
    styles.fontSize = `${settings.fontSize}px`;
  }
  if (settings.fontFamily) {
    styles.fontFamily = settings.fontFamily;
  }
  if (settings.fontWeight) {
    styles.fontWeight = settings.fontWeight;
  }
  if (settings.fontStyle) {
    styles.fontStyle = settings.fontStyle;
  }
  if (settings.letterSpacing !== undefined) {
    styles.letterSpacing = settings.letterSpacing;
  }
  if (settings.lineHeight !== undefined) {
    styles.lineHeight = settings.lineHeight;
  }
  if (settings.color) {
    styles.color = settings.color;
  }
  if (settings.textAlign) {
    styles.textAlign = settings.textAlign;
  }
  if (settings.textTransform) {
    styles.textTransform = settings.textTransform;
  }

  // Text Shadow
  if (settings.shadowEnabled) {
    styles.textShadow = `${settings.shadowOffsetX ?? 0}px ${settings.shadowOffsetY ?? 0}px ${settings.shadowBlur ?? 0}px ${settings.shadowColor || '#000000'}`;
  } else if (settings.shadowEnabled === false) {
    styles.textShadow = 'none';
  }

  // Stroke
  if (settings.strokeEnabled) {
    (styles as any).WebkitTextStroke = `${settings.strokeWidth ?? 1}px ${settings.strokeColor || '#000000'}`;
  } else if (settings.strokeEnabled === false) {
    (styles as any).WebkitTextStroke = 'unset';
  }

  // Spacing
  if (settings.marginTop !== undefined) {
    styles.marginTop = `${settings.marginTop}px`;
  }
  if (settings.marginBottom !== undefined) {
    styles.marginBottom = `${settings.marginBottom}px`;
  }
  if (settings.padding !== undefined) {
    styles.padding = `${settings.padding}px`;
  }

  return styles;
}

/**
 * Standard list of commonly used web and professional design fonts
 */
export const AVAILABLE_FONTS = [
  { name: 'System Sans', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Inter', value: '"Inter", sans-serif' },
  { name: 'Playfair Display', value: '"Playfair Display", serif' },
  { name: 'Plus Jakarta Sans', value: '"Plus Jakarta Sans", sans-serif' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Montserrat', value: '"Montserrat", sans-serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' }
];

/**
 * Text Element definitions for each of the modular Kanban card sections
 */
export const SECTION_TEXT_ELEMENTS: Record<string, { id: string; label: string }[]> = {
  master_info: [
    { id: 'productName', label: 'Product Name / Description' },
    { id: 'productCode', label: 'Product Code (Part Number Badge)' },
    { id: 'supplierPartNoLabel', label: 'Supplier Part No. Label' },
    { id: 'supplierPartNoValue', label: 'Supplier Part No. Value' },
    { id: 'supplierNameLabel', label: 'Supplier Name Label' },
    { id: 'supplierNameValue', label: 'Supplier Name Value' },
    { id: 'orderQtyLabel', label: 'Order Qty Label' },
    { id: 'orderQtyValue', label: 'Order Qty Value' },
    { id: 'deliveryLabel', label: 'Delivery Benchmark Label' },
    { id: 'deliveryValue', label: 'Delivery Benchmark Value' },
    { id: 'locationBadge', label: 'Location Badge Text' }
  ],
  kanban_pulled: [
    { id: 'productName', label: 'Product Name (Top Header)' },
    { id: 'warningText', label: 'Warning Banner (KANBAN PULLED)' },
    { id: 'binQtyLabel', label: 'Bin Quantity Label' },
    { id: 'binQtyValue', label: 'Bin Quantity Input/Display' },
    { id: 'locationBadge', label: 'Location Badge Text' }
  ],
  warehouse_id: [
    { id: 'headerEyebrow', label: 'Header Eyebrow (PRODUCT NAME)' },
    { id: 'productName', label: 'Product Name / Description' },
    { id: 'locationBadge', label: 'Location Badge Text' }
  ],
  warehouse_display: [
    { id: 'headerEyebrow', label: 'Header Eyebrow (PRODUCT NAME)' },
    { id: 'productName', label: 'Product Name / Description' },
    { id: 'locationBadge', label: 'Location Badge Text' }
  ]
};

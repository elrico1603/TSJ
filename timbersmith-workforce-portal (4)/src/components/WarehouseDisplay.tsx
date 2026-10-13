import React from 'react';
import { WarehouseSectionShared, WarehouseSectionProps } from './WarehouseSectionShared';

export type WarehouseDisplayProps = WarehouseSectionProps;

/**
 * WarehouseDisplay (Section 4) delegates to the shared WarehouseSectionShared renderer.
 */
export const WarehouseDisplay: React.FC<WarehouseDisplayProps> = (props) => {
  return <WarehouseSectionShared {...props} />;
};

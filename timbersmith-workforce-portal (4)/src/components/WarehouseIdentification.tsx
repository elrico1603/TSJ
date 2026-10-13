import React from 'react';
import { WarehouseSectionShared, WarehouseSectionProps } from './WarehouseSectionShared';

export type WarehouseIdentificationProps = WarehouseSectionProps;

/**
 * WarehouseIdentification (Section 3) delegates to the shared WarehouseSectionShared renderer.
 */
export const WarehouseIdentification: React.FC<WarehouseIdentificationProps> = (props) => {
  return <WarehouseSectionShared {...props} />;
};

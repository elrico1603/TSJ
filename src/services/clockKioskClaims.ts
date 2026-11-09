export type ClockKioskMode = 'test' | 'production';
export function matchesClockKioskClaims(claims:Record<string,unknown>, deviceId:string, mode:ClockKioskMode):boolean {
  return claims[mode==='production'?'clocking_production':'clocking_kiosk']===true &&
    claims.clocking_device_id===deviceId;
}

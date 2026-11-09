/** Realtime staff projection for authorized clocking/analytics viewers; credentials never leave HR storage. */
export function employeeView<T extends Record<string,any>>(employee:T):Record<string,any>{
  const copy={...employee};
  for(const key of ['personalCode','pin','clockPin','pinHash','password','passwordHash','address','idNumber','taxNumber','uifNumber','contactNumber'])delete copy[key];
  return copy;
}

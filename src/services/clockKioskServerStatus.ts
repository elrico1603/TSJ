/**
 * Read-only verification of an approved kiosk against a protected backend.
 * Pure transport: no Firebase SDK import, worker PIN, session or browser state.
 * A dedicated credential provider must be passed by the caller.
 */
export async function probeProtectedTestKiosk(
  registeredDeviceId:string,
  getToken:()=>Promise<string>,
  request:typeof fetch = fetch
):Promise<{deviceId:string;namespace:string;permittedEmployeeCount:number}> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(registeredDeviceId)) {
    throw new Error('Invalid registered kiosk device ID.');
  }
  const token=await getToken();
  if (!token || typeof token!=='string') {
    throw new Error('Kiosk identity is not enrolled or has expired.');
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await request('/api/clocking/test-device-status',{
      method:'GET',
      credentials:'omit',
      cache:'no-store',
      headers:{
        'Authorization':'Bearer '+token,
        'X-Clock-Device-ID':registeredDeviceId
      },
      signal:controller.signal
    });
    if (!response.ok) {
      if (response.status===401 || response.status===403) {
        throw new Error('Protected server refused this kiosk registration.');
      }
      throw new Error('Protected kiosk registry is unavailable or the local test API is disabled.');
    }
    const raw:unknown=await response.json();
    if (!raw || typeof raw!=='object') throw new Error('Invalid server kiosk status response.');
    const info=raw as Record<string,unknown>;
    if (info.registered!==true || info.deviceId!==registeredDeviceId ||
        typeof info.namespace!=='string' ||
        !/^timbersmith-clock-test-[a-z0-9-]{3,40}$/.test(info.namespace) ||
        !Number.isInteger(info.permittedEmployeeCount) ||
        Number(info.permittedEmployeeCount)<1) {
      throw new Error('Server did not confirm this specific enrolled test kiosk.');
    }
    return {
      deviceId:registeredDeviceId,
      namespace:info.namespace,
      permittedEmployeeCount:Number(info.permittedEmployeeCount)
    };
  } catch(error) {
    if(controller.signal.aborted) throw new Error('Protected kiosk registry check timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

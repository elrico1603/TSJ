/**
 * TS HUB — Client-Side Google Workspace / Gmail Service
 * Phase 4B Production Implementation
 * 
 * Communicates with the secure backend for Google OAuth status,
 * authorization initiation, and Purchase Order transmission via Gmail API.
 */

export interface GoogleConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  canSend: boolean;
}

export interface SendPOClientParams {
  employeeEmail: string;
  to: string;
  cc?: string[];
  subject: string;
  message: string;
  poNumber: string;
  pdfFileName: string;
  pdfBase64: string;
}

export interface SendPOClientResult {
  success: boolean;
  status: 'sent';
  gmailMessageId: string;
  senderGoogleEmail: string;
  recipient: string;
  sentAt: string;
}

export interface OAuthNotice {
  type: 'error' | 'success';
  message: string;
  email?: string;
  timestamp: number;
}

class GmailClientService {
  constructor() {
    this.cleanAuthUrlParams();
  }

  /**
   * Captures and cleans OAuth redirect query parameters from the browser address bar.
   * Stores any returned errors or confirmation notices in sessionStorage for visible display.
   */
  private cleanAuthUrlParams(): void {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const oauthError = url.searchParams.get('oauth_error') || url.searchParams.get('error') || url.searchParams.get('error_description');
      const googleAuth = url.searchParams.get('google_auth');
      const googleEmail = url.searchParams.get('google_email');

      if (oauthError) {
        try {
          sessionStorage.setItem('ts_gmail_oauth_notice', JSON.stringify({
            type: 'error',
            message: decodeURIComponent(oauthError),
            timestamp: Date.now()
          }));
        } catch {}
      } else if (googleAuth === 'success') {
        try {
          sessionStorage.setItem('ts_gmail_oauth_notice', JSON.stringify({
            type: 'success',
            message: `Google Workspace connected successfully${googleEmail ? ` for ${googleEmail}` : ''}.`,
            email: googleEmail || undefined,
            timestamp: Date.now()
          }));
        } catch {}
      }

      if (
        url.searchParams.has('google_auth') ||
        url.searchParams.has('session_id') ||
        url.searchParams.has('google_email') ||
        url.searchParams.has('oauth_error') ||
        url.searchParams.has('error') ||
        url.searchParams.has('error_description')
      ) {
        url.searchParams.delete('session_id');
        url.searchParams.delete('google_auth');
        url.searchParams.delete('google_email');
        url.searchParams.delete('oauth_error');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Retrieves any pending OAuth redirect error or success notice
   */
  public getAuthNotice(): OAuthNotice | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('ts_gmail_oauth_notice');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Clears consumed OAuth notice
   */
  public clearAuthNotice(): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem('ts_gmail_oauth_notice');
    } catch {}
  }

  /**
   * Resolves backend API URL based on environment
   */
  public getApiBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    const hostname = window.location.hostname.toLowerCase();

    // Production Netlify connects directly to Cloud Run service
    if (hostname === 'timbersmith-terminal.netlify.app') {
      return 'https://ts-hub-backend-859189362556.africa-south1.run.app';
    }

    // Default to relative path for proxy or direct server environments
    return '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Checks current Google Workspace OAuth session status
   */
  public async checkGoogleStatus(employeeEmail?: string): Promise<GoogleConnectionStatus> {
    try {
      const baseUrl = this.getApiBaseUrl();
      const query = employeeEmail ? `?employeeEmail=${encodeURIComponent(employeeEmail)}` : '';
      const response = await fetch(`${baseUrl}/api/auth/google/status${query}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        return { connected: false, googleEmail: null, canSend: false };
      }

      return await response.json();
    } catch (e) {
      console.warn('[GmailClientService] Status check notice:', e);
      return { connected: false, googleEmail: null, canSend: false };
    }
  }

  /**
   * Obtains Google OAuth Authorization URL for the employee
   */
  public async getAuthorizeUrl(employeeEmail: string): Promise<string> {
    const baseUrl = this.getApiBaseUrl();
    const returnUrl = typeof window !== 'undefined' ? window.location.href : 'https://timbersmith-terminal.netlify.app/';
    const url = `${baseUrl}/api/auth/google/authorize?employeeEmail=${encodeURIComponent(employeeEmail)}&returnUrl=${encodeURIComponent(returnUrl)}&format=json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to generate Google authorization URL.');
    }

    const data = await response.json();
    return data.url;
  }

  /**
   * Disconnects / Logs out the active Google session
   */
  public async disconnectGoogle(employeeEmail?: string): Promise<void> {
    const baseUrl = this.getApiBaseUrl();
    await fetch(`${baseUrl}/api/auth/google/logout`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ employeeEmail })
    });
  }

  /**
   * Transmits the Purchase Order via Gmail API
   */
  public async sendPurchaseOrder(params: SendPOClientParams): Promise<SendPOClientResult> {
    const baseUrl = this.getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/mail/send-purchase-order`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(params)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to transmit Purchase Order via Gmail API.');
    }

    return result as SendPOClientResult;
  }
}

export const gmailClientService = new GmailClientService();

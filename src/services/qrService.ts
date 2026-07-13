/**
 * Service to handle QR code generation and link mapping.
 */

/**
 * Generates the target URL for a specific Kanban Card.
 * @param kanbanId Unique identifier of the Kanban Card
 * @returns The deep link URL pointing to the PWA Kanban detail view
 */
export function getKanbanTargetUrl(kanbanId: string): string {
  const origin = window.location.origin;
  return `${origin}/kanban/${kanbanId}`;
}

/**
 * Generates an image URL for the QR Code pointing to the Kanban Card.
 * Uses a robust, free QR generation service.
 * @param kanbanId Unique identifier of the Kanban Card
 * @param size Resolution size of the QR Code (e.g., 150)
 * @returns Image source URL of the QR code
 */
export function getKanbanQRCodeImageUrl(kanbanId: string, size = 150): string {
  const targetUrl = getKanbanTargetUrl(kanbanId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
}

export type CandidateDeliveryChannel = 'IN_APP' | 'EMAIL' | 'IN_APP_AND_EMAIL' | 'UNAVAILABLE' | string | null | undefined;

export interface CandidateDeliveryActionResult {
  message?: string;
  deliveryChannel?: CandidateDeliveryChannel;
  data?: {
    deliveryChannel?: CandidateDeliveryChannel;
    message?: string;
  };
}

export const deliveryChannelFromResult = (result: CandidateDeliveryActionResult | null | undefined): CandidateDeliveryChannel =>
  result?.deliveryChannel ?? result?.data?.deliveryChannel;

/** Honest Client-facing copy: EMAIL means queued in the durable outbox, not already delivered. */
export const deliveryFeedback = (result: CandidateDeliveryActionResult | null | undefined, fallback: string): string => {
  const baseMessage = result?.message ?? result?.data?.message ?? fallback;
  switch (deliveryChannelFromResult(result)) {
    case 'IN_APP':
      return `${baseMessage} Ứng viên đã nhận thông báo trên HR Connect.`;
    case 'EMAIL':
      return `${baseMessage} Hệ thống đã đưa email thông báo vào hàng đợi gửi cho ứng viên.`;
    case 'IN_APP_AND_EMAIL':
      return `${baseMessage} Ứng viên đã nhận thông báo trên HR Connect và hệ thống đã đưa email vào hàng đợi gửi.`;
    case 'UNAVAILABLE':
      return `${baseMessage} Không tìm thấy kênh liên hệ của ứng viên.`;
    default:
      return baseMessage;
  }
};

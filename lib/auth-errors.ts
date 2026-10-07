export const authMessages = {
 AUTH_INVALID_REQUEST: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.',
 AUTH_PHONE_REQUIRED: 'Vui lòng nhập số điện thoại.',
 AUTH_PHONE_INVALID: 'Số điện thoại không hợp lệ. Ví dụ: 0901234567.',
 AUTH_PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu.',
 AUTH_PASSWORD_POLICY: 'Mật khẩu mới cần từ 10 đến 128 ký tự.',
 AUTH_PASSWORD_TOO_LONG: 'Mật khẩu không được vượt quá 128 ký tự.',
 AUTH_NAME_INVALID: 'Vui lòng nhập họ tên từ 1 đến 100 ký tự.',
 AUTH_WORKSPACE_INVALID: 'Tên không gian cần từ 1 đến 100 ký tự.',
 AUTH_INVALID_CREDENTIALS: 'Số điện thoại hoặc mật khẩu không đúng.',
 AUTH_PHONE_EXISTS: 'Số điện thoại đã có tài khoản. Hãy đăng nhập hoặc khôi phục mật khẩu.',
 AUTH_RATE_LIMITED: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.',
 AUTH_SESSION_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
 AUTH_CURRENT_PASSWORD_INVALID: 'Mật khẩu hiện tại không đúng.',
 AUTH_RECOVERY_REQUIRED: 'Vui lòng nhập mã khôi phục đã lưu.',
 AUTH_RECOVERY_INVALID: 'Số điện thoại hoặc mã khôi phục không đúng.',
 AUTH_CONFLICT: 'Thông tin tài khoản đã thay đổi. Vui lòng thử lại.',
 AUTH_ORIGIN_REJECTED: 'Yêu cầu bị từ chối. Hãy tải lại trang và thử lại.',
 AUTH_UNAVAILABLE: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.',
 AUTH_NETWORK_ERROR: 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.',
 AUTH_PASSWORD_MISMATCH: 'Hai mật khẩu chưa khớp.',
} as const;
export type AuthCode = keyof typeof authMessages;
export class AuthError extends Error {
 constructor(public code: AuthCode, public status = 400) { super(authMessages[code]); }
}
export function authErrorResponse(code: AuthCode, status: number) {
 return Response.json({code, error: authMessages[code]}, {status, headers: {'Cache-Control': 'no-store', ...(status === 429 ? {'Retry-After': '900'} : {})}});
}

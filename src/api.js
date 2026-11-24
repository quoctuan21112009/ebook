export async function readApiJson(response) {
  const type = response.headers.get('content-type') || ''
  if (!/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(type)) {
    throw new Error(`Máy chủ đọc sách chưa phản hồi đúng (HTTP ${response.status}). Vui lòng thử lại sau hoặc kiểm tra máy chủ của trang web.`)
  }
  try {
    return await response.json()
  } catch {
    throw new Error('Máy chủ đọc sách trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.')
  }
}

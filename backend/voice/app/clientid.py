"""Xác định danh tính client để giới hạn tần suất.

Chạy sau reverse proxy, `request.client.host` là IP của proxy chứ không phải người
dùng, nên mọi người dùng sẽ chung một hạn mức. `X-Forwarded-For` chứa IP thật, nhưng
**chỉ được tin khi proxy nằm trong danh sách đáng tin** — nếu tin vô điều kiện thì
bất kỳ ai cũng đặt header giả để né hạn mức.

Lớp thuần, tách khỏi FastAPI để test được.
"""

from __future__ import annotations


def parse_forwarded_for(header: str | None) -> list[str]:
    """Tách `X-Forwarded-For` thành danh sách IP, bỏ khoảng trắng và ô rỗng.

    Header có dạng `client, proxy1, proxy2` — IP gần client nhất nằm **đầu** danh sách.
    """
    if not header:
        return []
    return [part.strip() for part in header.split(",") if part.strip()]


def resolve_client_ip(
    peer_ip: str | None,
    forwarded_for: str | None,
    trusted_proxies: frozenset[str],
) -> str:
    """Trả IP dùng làm khoá giới hạn tần suất.

    Chỉ đọc `X-Forwarded-For` khi kết nối trực tiếp đến từ một proxy đáng tin; khi đó
    lấy IP ngoài cùng bên phải *không* thuộc danh sách proxy tin cậy — đó là người
    dùng thật, còn các IP proxy bị nối thêm vào header không thể giả mạo.
    """
    if not peer_ip:
        return "unknown"
    if peer_ip not in trusted_proxies:
        # Kết nối trực tiếp: bỏ qua header vì client có thể tự đặt.
        return peer_ip

    # Duyệt từ phải sang trái, bỏ qua các proxy tin cậy đã nối vào chuỗi.
    chain = parse_forwarded_for(forwarded_for)
    for candidate in reversed(chain):
        if candidate not in trusted_proxies:
            return candidate
    # Toàn bộ chuỗi đều là proxy tin cậy (hoặc header rỗng): dùng IP kết nối trực tiếp.
    return peer_ip
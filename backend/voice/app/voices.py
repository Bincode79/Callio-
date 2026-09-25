"""Ánh xạ nhãn giọng trong sản phẩm sang mã giọng edge-tts.

Lớp thuần, không phụ thuộc mạng hay thư viện ngoài, nên test được trực tiếp.
"""

from __future__ import annotations

# edge-tts hiện chỉ có hai giọng tiếng Việt. Sản phẩm có bốn nhãn (nam/nữ × Bắc/Nam)
# nên phải ánh xạ: giới tính quyết định giọng, còn miền không có giọng riêng.
VOICE_FEMALE = "vi-VN-HoaiMyNeural"
VOICE_MALE = "vi-VN-NamMinhNeural"

# Nhãn -> mã giọng, khai báo tường minh để tra cứu nhanh và dễ đọc.
LABEL_TO_VOICE: dict[str, str] = {
    "Giọng nữ miền Bắc - Linh An": VOICE_FEMALE,
    "Giọng nữ miền Nam - Thuỳ Dương": VOICE_FEMALE,
    "Giọng nam miền Bắc - Đức Thịnh": VOICE_MALE,
    "Giọng nam miền Nam - Minh Khang": VOICE_MALE,
}


def resolve_voice(label: str | None, fallback: str = VOICE_FEMALE) -> str:
    """Trả mã giọng edge-tts cho một nhãn sản phẩm.

    Nhãn chưa có trong bảng thì suy theo giới tính trong chuỗi; không suy được thì
    dùng `fallback`. Không ném lỗi vì nhãn là văn bản hiển thị, có thể đổi tự do.
    """
    if not label:
        return fallback
    if label in LABEL_TO_VOICE:
        return LABEL_TO_VOICE[label]
    lowered = label.lower()
    # Kiểm tra "nữ" trước "nam": "nam" vừa là giới tính vừa nằm trong "miền Nam".
    if "nữ" in lowered:
        return VOICE_FEMALE
    if "nam" in lowered:
        return VOICE_MALE
    return fallback

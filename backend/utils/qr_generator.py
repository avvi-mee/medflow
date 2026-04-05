"""Generate QR codes as base64 PNG strings."""
import base64
import io
from typing import Optional

try:
    import qrcode
    from qrcode.image.pil import PilImage
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False


def generate_qr_base64(data: str, box_size: int = 10, border: int = 4) -> Optional[str]:
    """Generate QR code for data string, return as base64 PNG."""
    if not QR_AVAILABLE:
        return None

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def generate_queue_tag(test_id: str, patient_name: str, queue_number: int, risk_level: str) -> str:
    """Generate QR code data URL for queue tag."""
    tag_data = f"MEDFLOW|{test_id}|{patient_name}|Q{queue_number:04d}|{risk_level}"
    b64 = generate_qr_base64(tag_data)
    if b64:
        return f"data:image/png;base64,{b64}"
    # Fallback: return tag_data as plain text
    return tag_data

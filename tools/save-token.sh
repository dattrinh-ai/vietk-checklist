#!/bin/zsh
# Lưu Supabase Access Token của tài khoản VietK vào supabase/.token (nhập ẩn, không đưa lên git).
cd "$(dirname "$0")/.."
read -rs "T?Dán SUPABASE ACCESS TOKEN (sbp_...) rồi Enter: "; echo
T=${T//[[:space:]]/}
[[ "$T" == sbp_* ]] || { echo "❌ Token phải bắt đầu bằng sbp_ — thử lại"; exit 1; }
umask 077; print -rn -- "$T" > supabase/.token
REF=$(cat supabase/.ref)
if SUPABASE_ACCESS_TOKEN="$T" npx --yes supabase@latest projects list 2>/dev/null | grep -q "$REF"; then
  echo "✅ Đã lưu token — truy cập được project VietK ($REF)."
else
  echo "⚠️ Đã lưu nhưng token này không thấy project $REF — kiểm tra lại tài khoản tạo token."
fi

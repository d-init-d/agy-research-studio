# Quy tắc phối hợp AGY Research Studio

Khi người dùng thực hiện các tác vụ nghiên cứu sâu (d-research) hoặc mô phỏng dòng thời gian nhân quả (aleph-skill):

1. **Điều hướng giao diện (UI Navigation Pill):**
   - Khi bắt đầu hoặc hoàn thành một đợt nghiên cứu/mô phỏng, hãy cung cấp một nút bấm tắt (Pill link) trỏ đến Side Pane:
     ```markdown
     👉 [📊 Mở AGY Research Studio](sidecar://agy-research-studio/panel/)
     ```
   - Nhắc người dùng có thể theo dõi đồ thị mạng lưới tri thức Obsidian (Knowledge Graph) và các nhánh kịch bản thời gian thực tại bảng điều khiển.

2. **Đồng bộ hóa dữ liệu (Workspace Artifacts):**
   - Khi thu thập bằng chứng từ web qua `d-research`, ghi chép hoặc cập nhật file `evidence-ledger.jsonl` và `research-coverage.json` trong workspace.
   - Khi chạy mô phỏng qua `aleph-skill`, cập nhật các file `timeline.json` hoặc đồ thị DAG để Sidecar UI tự động đọc và vẽ đồ thị tương tác.

3. **Bảo vệ tiền điều kiện (Dependency Check):**
   - Nếu phát hiện môi trường thiếu `d-research` hoặc `aleph-skill`, hướng dẫn người dùng kích hoạt hoặc cài đặt đầy đủ trước khi chạy mô phỏng phức tạp.

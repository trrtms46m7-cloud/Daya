-- 報修登記系統初始建表腳本：僅供審閱與日後手動部署，本次不執行。
-- 請以資料庫管理角色在尚無此表的 Supabase 專案執行；重複執行會失敗。
BEGIN;

-- 資料結構：所有欄位必填，識別碼與含時區的建立時間由資料庫自動產生。
CREATE TABLE public.repair_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    reporter_name text NOT NULL,
    location text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    urgency text NOT NULL DEFAULT '中',
    status text NOT NULL DEFAULT '待處理',

    -- CHECK 第一部分：長度以字元計算，限制原始文字長度並排除全空白內容。
    CONSTRAINT repair_requests_reporter_name_check CHECK (
        char_length(reporter_name) BETWEEN 1 AND 100
        AND reporter_name ~ '[^[:space:]]'
    ),
    CONSTRAINT repair_requests_location_check CHECK (
        char_length(location) BETWEEN 1 AND 200
        AND location ~ '[^[:space:]]'
    ),
    CONSTRAINT repair_requests_description_check CHECK (
        char_length(description) BETWEEN 1 AND 5000
        AND description ~ '[^[:space:]]'
    ),

    -- CHECK 第二部分：固定選項必須完全符合指定值，亦限制其文字長度。
    CONSTRAINT repair_requests_category_check CHECK (
        category IN ('設備', '網路', '環境', '其他')
        AND char_length(category) = 2
    ),
    CONSTRAINT repair_requests_urgency_check CHECK (
        urgency IN ('低', '中', '高') AND char_length(urgency) = 1
    ),
    CONSTRAINT repair_requests_status_check CHECK (
        status IN ('待處理', '處理中', '已完成') AND char_length(status) = 3
    )
);

-- GRANT：明確清除一般 API 角色的表級權限；新表尚無欄位級授權。
-- 不依賴新表的預設授權，也不授予 authenticated 角色存取權。
REVOKE ALL PRIVILEGES ON TABLE public.repair_requests FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.repair_requests TO anon;
-- anon 只可新增表單欄位；不得指定 id、created_at、status，也無修改或刪除權限。
GRANT INSERT (reporter_name, location, category, description, urgency)
    ON TABLE public.repair_requests TO anon;

-- RLS：表級授權與資料列政策必須同時通過；未建立修改與刪除政策。
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;

-- 讀取政策：任何未登入訪客均可透過 anon 讀取完整共用清單。
CREATE POLICY repair_requests_anon_select
    ON public.repair_requests
    FOR SELECT TO anon
    USING (true);

-- 新增政策：即使日後調整欄位授權，新增資料的狀態仍必須是「待處理」。
CREATE POLICY repair_requests_anon_insert
    ON public.repair_requests
    FOR INSERT TO anon
    WITH CHECK (status = '待處理');

-- 原子性：日後部署時，建表、授權與安全政策必須整批成功才提交。
COMMIT;

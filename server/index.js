const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'bema_demo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    insecureAuth: true
});

// --- 登入/註冊 (維持不變) ---
app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ? AND role = ?', [username, password, role], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) res.json({ success: true, user: result[0] });
        else res.json({ success: false, message: '登入失敗' });
    });
});

app.post('/api/register', (req, res) => { /* ...省略，維持原樣... */ });

// --- 醫師功能: 患者管理 ---
// 1. 取得該醫師的所有患者
app.get('/api/patients', (req, res) => {
    // 實務上應該要 WHERE doctor_id = ?, 這裡先簡化抓全部
    db.query('SELECT * FROM patients ORDER BY created_at DESC', (err, result) => res.send(err || result));
});

// 2. 新增患者 (更新版：支援詳細地址)
app.post('/api/patients', (req, res) => {
    // 從前端接收所有欄位
    const {
        patientNumber, firstName, lastName, gender,
        tel, mobile,
        address, city, state, zip, country, // <--- 這裡要接收詳細地址
        doctorId
    } = req.body;

    const sql = `
        INSERT INTO patients 
        (patient_number, first_name, last_name, gender, tel, mobile, address, city, state, zip_code, country, doctor_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // 依序填入數值
    db.query(sql, [
        patientNumber, firstName, lastName, gender,
        tel, mobile,
        address, city, state, zip, country, // <--- 對應寫入資料庫
        doctorId
    ], (err, result) => {
        if (err) {
            console.error(err); // 印出錯誤以便除錯
            return res.status(500).json(err);
        }
        res.json({ success: true, id: result.insertId });
    });
});

// --- 醫師功能: 訂單管理 ---
// 1. 送出新訂單 (更新版：完整儲存處方內容)
app.post('/api/orders', (req, res) => {
    // 這裡接收前端傳來的所有資料
    const { doctorId, patientId, content, shipping } = req.body;

    // 產生一組不重複的訂單編號 (例如: RX-20251216-時間戳記)
    const orderNo = 'RX' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.floor(Date.now() / 1000);

    // 關鍵修改：把 content (藥單物件) 轉成 JSON 字串存進去
    // 注意：如果是 MySQL 5.7+，可以直接存 JSON；如果是舊版，要用 JSON.stringify(content)
    const sql = 'INSERT INTO orders (order_no, doctor_id, patient_id, status, shipping_method, content) VALUES (?, ?, ?, ?, ?, ?)';

    // content 是一個物件，MySQL 的 JSON 欄位會自動處理它
    // 如果您是用 DBngin (通常是 MySQL 8.0)，直接傳 content 即可
    // 如果報錯，請試著改成 JSON.stringify(content)
    const contentData = JSON.stringify(content);

    db.query(sql, [orderNo, doctorId, patientId, 'pending', shipping, contentData], (err, result) => {
        if (err) {
            console.error("儲存訂單失敗:", err);
            return res.status(500).json(err);
        }
        console.log("✅ 訂單已儲存，單號:", orderNo);
        res.json({ success: true, orderNo });
    });
});
// 2. 取得歷史訂單
app.get('/api/orders', (req, res) => {
    const sql = `
        SELECT orders.*, patients.first_name, patients.last_name 
        FROM orders 
        LEFT JOIN patients ON orders.patient_id = patients.id 
        ORDER BY created_at DESC`;
    db.query(sql, (err, result) => res.send(err || result));
});

// --- 藥材資料 ---
app.get('/api/medicines', (req, res) => {
    db.query('SELECT * FROM medicines', (err, result) => res.send(err || result));
});

// --- Pharmacy Feature: Update Order Status ---
app.put('/api/orders/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// --- Admin Feature: User Management ---
app.get('/api/users', (req, res) => {
    db.query('SELECT * FROM users', (err, result) => res.send(err || result));
});

app.post('/api/users', (req, res) => {
    const { username, password, role, name } = req.body;
    db.query('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
        [username, password, role, name],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true, id: result.insertId });
        }
    );
});

app.put('/api/users/:id', (req, res) => {
    const { username, password, role, name } = req.body;
    db.query('UPDATE users SET username=?, password=?, role=?, name=? WHERE id=?',
        [username, password, role, name, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true });
        }
    );
});

app.delete('/api/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// --- Admin Feature: Settings (Pricing & Restrictions) ---
app.get('/api/settings', (req, res) => {
    db.query('SELECT * FROM system_settings', (err, result) => res.send(err || result));
});

app.post('/api/settings', (req, res) => {
    const { key, value, description } = req.body;
    // Check if exists
    db.query('SELECT * FROM system_settings WHERE setting_key = ?', [key], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            // Update
            db.query('UPDATE system_settings SET setting_value = ?, description = ? WHERE setting_key = ?',
                [value, description, key],
                (err, result) => res.json({ success: true, action: 'updated' })
            );
        } else {
            // Insert
            db.query('INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
                [key, value, description],
                (err, result) => res.json({ success: true, action: 'created' })
            );
        }
    });
});

app.listen(3001, () => console.log("✅ Server running on port 3001"));